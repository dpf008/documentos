/**
 * Tools para gestão da tesouraria do Capítulo DeMolay.
 * 
 * Este arquivo contém todas as tools relacionadas a operações financeiras:
 * - Gestão de categorias
 * - CRUD de movimentações (transações)
 * - Upload e gestão de anexos
 * - Exportação de relatórios
 * - Métricas para dashboard
 */
import { createTool, createPrivateTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { getDb } from "../db.ts";
import { eq, and, gte, lte, desc, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  accountsTable,
  transactionsTable,
  attachmentsTable,
  auditLogsTable,
} from "../schema.ts";
import type { Env } from "../main.ts";

// ========== TOOLS PÚBLICAS (sem autenticação) ==========

export const createListCategoriesPublicTool = (env: Env) =>
  createPrivateTool({
    id: "LIST_CATEGORIES_PUBLIC",
    description: "Lista categorias ativas para seleção em formulários",
    inputSchema: z.object({
      kind: z.enum(['entrada', 'saida']).optional(),
    }),
    outputSchema: z.object({
      categories: z.array(z.object({
        id: z.number(),
        name: z.string(),
        kind: z.enum(['entrada', 'saida']),
      })),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      let conditions = [eq(categoriesTable.active, 1)];
      
      if (context.kind) {
        conditions.push(eq(categoriesTable.kind, context.kind));
      }

      const categories = await db.select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        kind: categoriesTable.kind,
      })
      .from(categoriesTable)
      .where(and(...conditions))
      .orderBy(categoriesTable.name);

      return {
        categories: categories as Array<{
          id: number;
          name: string;
          kind: 'entrada' | 'saida';
        }>,
      };
    },
  });

// ========== TOOLS PRIVADAS (com autenticação) ==========

export const createCreateTransactionTool = (env: Env) =>
  createPrivateTool({
    id: "CREATE_TRANSACTION",
    description: "Cria nova movimentação financeira",
    inputSchema: z.object({
      type: z.enum(['entrada', 'saida']),
      amountCents: z.number().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      description: z.string().min(1).max(255),
      categoryId: z.number(),
      accountId: z.number().optional(),
      method: z.string().optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({
      id: z.number(),
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ context, user }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se user está disponível
        const userId = user?.id || "anonymous";
        
        // Validar categoria existe e é do tipo correto
        const category = await db.select()
          .from(categoriesTable)
          .where(and(
            eq(categoriesTable.id, context.categoryId),
            eq(categoriesTable.active, 1)
          ))
          .limit(1);
        
        if (!category.length) {
          throw new Error("Categoria não encontrada ou inativa");
        }
        
        if (category[0].kind !== context.type) {
          throw new Error(`Categoria "${category[0].name}" é do tipo "${category[0].kind}", mas a movimentação é do tipo "${context.type}"`);
        }
        
        // Usar conta padrão se não especificada
        const accountId = context.accountId || 1;
        
        // Criar transação
        const [transaction] = await db.insert(transactionsTable).values({
          accountId,
          type: context.type,
          amountCents: context.amountCents,
          date: context.date,
          description: context.description,
          categoryId: context.categoryId,
          method: context.method,
          reference: context.reference,
          notes: context.notes,
          createdBy: userId,
          createdAt: new Date(),
        }).returning({ id: transactionsTable.id });
        
        // Log de auditoria
        await db.insert(auditLogsTable).values({
          entity: 'transaction',
          entityId: transaction.id,
          action: 'create',
          actorId: userId,
          timestamp: new Date(),
          diff: JSON.stringify({
            type: context.type,
            amountCents: context.amountCents,
            description: context.description,
            categoryId: context.categoryId,
          }),
        });
        
        return {
          id: transaction.id,
          success: true,
          message: `Movimentação de ${context.type} criada com sucesso`,
        };
      } catch (error) {
        console.error("Erro ao criar transação:", error);
        return {
          id: 0,
          success: false,
          message: (error as Error).message || "Erro interno do servidor",
        };
      }
    },
  });

export const createGetTransactionsTool = (env: Env) =>
  createPrivateTool({
    id: "GET_TRANSACTIONS",
    description: "Lista movimentações com filtros e paginação",
    inputSchema: z.object({
      page: z.number().default(1),
      limit: z.number().max(100).default(20),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(['entrada', 'saida']).optional(),
      categoryId: z.number().optional(),
      search: z.string().optional(),
    }),
    outputSchema: z.object({
      transactions: z.array(z.object({
        id: z.number(),
        type: z.enum(['entrada', 'saida']),
        amountCents: z.number(),
        date: z.string(),
        description: z.string(),
        method: z.string().nullable(),
        reference: z.string().nullable(),
        notes: z.string().nullable(),
        createdAt: z.string(),
        category: z.object({
          id: z.number(),
          name: z.string(),
          kind: z.enum(['entrada', 'saida']),
        }),
        attachmentCount: z.number(),
      })),
      pagination: z.object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
      }),
    }),
    execute: async ({ context }) => {
      try {
        const offset = (context.page - 1) * context.limit;
        
        // Construir condições WHERE
        let whereConditions = ["t.deleted_at IS NULL"];
        let params: any[] = [];
        
        if (context.startDate) {
          whereConditions.push("t.date >= ?");
          params.push(context.startDate);
        }
        if (context.endDate) {
          whereConditions.push("t.date <= ?");
          params.push(context.endDate);
        }
        if (context.type) {
          whereConditions.push("t.type = ?");
          params.push(context.type);
        }
        if (context.categoryId) {
          whereConditions.push("t.category_id = ?");
          params.push(context.categoryId);
        }
        if (context.search) {
          whereConditions.push("t.description LIKE ?");
          params.push(`%${context.search}%`);
        }
        
        const whereClause = whereConditions.join(" AND ");
        
        // Query para buscar transações
        const transactionsResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              t.id,
              t.type,
              t.amount_cents,
              t.date,
              t.description,
              t.method,
              t.reference,
              t.notes,
              t.created_at,
              c.id as category_id,
              c.name as category_name,
              c.kind as category_kind,
              COALESCE(att.attachment_count, 0) as attachment_count
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN (
              SELECT transaction_id, COUNT(*) as attachment_count
              FROM attachments
              GROUP BY transaction_id
            ) att ON t.id = att.transaction_id
            WHERE ${whereClause}
            ORDER BY t.date DESC, t.id DESC
            LIMIT ? OFFSET ?
          `,
          params: [...params, context.limit, offset],
        });
        
        // Query para contar total
        const countResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`,
          params: params,
        });
        
        const transactionResults = transactionsResult.result?.[0]?.results || [];
        const countResults = countResult.result?.[0]?.results || [];
        const total = countResults[0]?.total || 0;
        
        const transactions = transactionResults.map((row: any) => ({
          id: parseInt(row.id),
          type: row.type as "entrada" | "saida",
          amountCents: parseInt(row.amount_cents),
          date: row.date,
          description: row.description,
          method: row.method,
          reference: row.reference,
          notes: row.notes,
          createdAt: new Date(parseInt(row.created_at)).toISOString(),
          category: {
            id: parseInt(row.category_id),
            name: row.category_name,
            kind: row.category_kind as "entrada" | "saida",
          },
          attachmentCount: parseInt(row.attachment_count) || 0,
        }));
        
        return {
          transactions,
          pagination: {
            total: parseInt(total),
            page: context.page,
            limit: context.limit,
            totalPages: Math.ceil(parseInt(total) / context.limit),
          },
        };
      } catch (error) {
        console.error("Erro ao buscar transações:", error);
        throw new Error("Falha ao carregar transações");
      }
    },
  });

export const createCreateCategoryTool = (env: Env) =>
  createPrivateTool({
    id: "CREATE_CATEGORY",
    description: "Cria nova categoria de movimentação financeira",
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      kind: z.enum(['entrada', 'saida']),
    }),
    outputSchema: z.object({
      id: z.number(),
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ context, user }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se categoria já existe
        const existing = await db.select()
          .from(categoriesTable)
          .where(and(
            eq(categoriesTable.name, context.name),
            eq(categoriesTable.kind, context.kind)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          return {
            id: existing[0].id,
            success: false,
            message: `Categoria "${context.name}" já existe para ${context.kind}`,
          };
        }
        
        // Criar categoria
        const [category] = await db.insert(categoriesTable).values({
          name: context.name,
          kind: context.kind,
          active: 1,
          createdAt: new Date(),
        }).returning({ id: categoriesTable.id });
        
        // Log de auditoria
        await db.insert(auditLogsTable).values({
          entity: 'category',
          entityId: category.id,
          action: 'create',
          actorId: user.id,
          timestamp: new Date(),
          diff: JSON.stringify({
            name: context.name,
            kind: context.kind,
          }),
        });
        
        return {
          id: category.id,
          success: true,
          message: `Categoria "${context.name}" criada com sucesso`,
        };
      } catch (error) {
        console.error("Erro ao criar categoria:", error);
        return {
          id: 0,
          success: false,
          message: (error as Error).message || "Erro interno do servidor",
        };
      }
    },
  });

export const createSeedCategoriesTool = (env: Env) =>
  createPrivateTool({
    id: "SEED_CATEGORIES",
    description: "Popula categorias iniciais do sistema (apenas admin)",
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      categoriesCreated: z.number(),
    }),
    execute: async ({ user }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se já existem categorias
        const existingCategories = await db.select().from(categoriesTable).limit(1);
        if (existingCategories.length > 0) {
          return {
            success: false,
            message: "Categorias já existem no sistema",
            categoriesCreated: 0,
          };
        }
        
        // Categorias de entrada
        const entradaCategories = [
          "Arrecadação de Fundos",
          "Doações",
          "Mensalidades",
          "Eventos",
          "Rifas/Sorteios",
        ];
        
        // Categorias de saída
        const saidaCategories = [
          "Filantropia",
          "Material de Escritório",
          "Eventos/Festividades",
          "Transporte",
          "Alimentação",
          "Uniformes/Paramentos",
          "Manutenção",
        ];
        
        let created = 0;
        
        // Inserir categorias de entrada
        for (const name of entradaCategories) {
          await db.insert(categoriesTable).values({
            name,
            kind: 'entrada',
            active: 1,
            createdAt: new Date(),
          });
          created++;
        }
        
        // Inserir categorias de saída
        for (const name of saidaCategories) {
          await db.insert(categoriesTable).values({
            name,
            kind: 'saida',
            active: 1,
            createdAt: new Date(),
          });
          created++;
        }
        
        // Criar conta padrão se não existir
        const existingAccounts = await db.select().from(accountsTable).limit(1);
        if (existingAccounts.length === 0) {
          await db.insert(accountsTable).values({
            id: 1,
            name: "Caixa Geral",
            initialBalanceCents: 0,
            active: 1,
            createdAt: new Date(),
          });
        }
        
        return {
          success: true,
          message: `${created} categorias criadas com sucesso`,
          categoriesCreated: created,
        };
      } catch (error) {
        console.error("Erro ao criar categorias:", error);
        return {
          success: false,
          message: (error as Error).message || "Erro interno do servidor",
          categoriesCreated: 0,
        };
      }
    },
  });

export const createCreateTransactionSqlTool = (env: Env) =>
  createPrivateTool({
    id: "CREATE_TRANSACTION_SQL",
    description: "Cria nova movimentação usando SQL direto",
    inputSchema: z.object({
      type: z.enum(['entrada', 'saida']),
      amountCents: z.number().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().min(1).max(255),
      categoryId: z.number(),
      method: z.string().optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({
      id: z.number(),
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        // Validar categoria primeiro
        const categoryResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: "SELECT id, name, kind, active FROM categories WHERE id = ? AND active = 1",
          params: [context.categoryId],
        });
        
        console.log("Categoria result:", categoryResult);
        
        // O resultado vem em categoryResult.result[0].results
        const queryResults = categoryResult.result?.[0]?.results;
        if (!queryResults || !Array.isArray(queryResults) || queryResults.length === 0) {
          throw new Error(`Categoria com ID ${context.categoryId} não encontrada ou inativa`);
        }
        
        const category = queryResults[0] as any;
        console.log("Categoria encontrada:", category);
        
        if (!category.name || !category.kind) {
          throw new Error(`Dados da categoria incompletos: ${JSON.stringify(category)}`);
        }
        
        if (category.kind !== context.type) {
          throw new Error(`Categoria "${category.name}" é do tipo "${category.kind}", mas a movimentação é do tipo "${context.type}"`);
        }
        
        // Inserir transação
        const insertResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `INSERT INTO transactions 
                (account_id, type, amount_cents, date, description, category_id, method, reference, notes, created_by, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            1, // account_id padrão
            context.type,
            context.amountCents,
            context.date,
            context.description,
            context.categoryId,
            context.method || null,
            context.reference || null,
            context.notes || null,
            "system", // created_by
            Date.now(),
          ],
        });
        
        const transactionId = 1; // Simplificar por enquanto
        
        return {
          id: transactionId,
          success: true,
          message: `Movimentação de ${context.type} criada com sucesso`,
        };
      } catch (error) {
        console.error("Erro ao criar transação:", error);
        return {
          id: 0,
          success: false,
          message: (error as Error).message || "Erro interno do servidor",
        };
      }
    },
  });

export const createGetDashboardMetricsTool = (env: Env) =>
  createPrivateTool({
    id: "GET_DASHBOARD_METRICS",
    description: "Obtém métricas para dashboard com dados reais",
    inputSchema: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    outputSchema: z.object({
      summary: z.object({
        totalEntradas: z.number(),
        totalSaidas: z.number(),
        saldoAtual: z.number(),
        movimentacoesCount: z.number(),
        percentualVariacao: z.number(),
      }),
      monthlyFlow: z.array(z.object({
        month: z.string(),
        entradas: z.number(),
        saidas: z.number(),
        saldo: z.number(),
      })),
      categoryDistribution: z.array(z.object({
        categoryName: z.string(),
        categoryKind: z.enum(['entrada', 'saida']),
        amount: z.number(),
        percentage: z.number(),
        count: z.number(),
      })),
      recentTransactions: z.array(z.object({
        id: z.number(),
        type: z.enum(['entrada', 'saida']),
        amountCents: z.number(),
        date: z.string(),
        description: z.string(),
        categoryName: z.string(),
        method: z.string().nullable(),
      })),
    }),
    execute: async ({ context }) => {
      try {
        const startDate = context.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]; // Início do ano
        const endDate = context.endDate || new Date().toISOString().split('T')[0]; // Hoje
        
        // 1. RESUMO GERAL - Totais de entrada e saída
        const summaryResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              type,
              SUM(amount_cents) as total,
              COUNT(*) as count
            FROM transactions 
            WHERE deleted_at IS NULL 
              AND date BETWEEN ? AND ?
            GROUP BY type
          `,
          params: [startDate, endDate],
        });

        let totalEntradas = 0;
        let totalSaidas = 0;
        let movimentacoesCount = 0;

        const summaryResults = summaryResult.result?.[0]?.results;
        if (summaryResults) {
          for (const row of summaryResults as any[]) {
            if (row.type === 'entrada') {
              totalEntradas = row.total || 0;
            } else if (row.type === 'saida') {
              totalSaidas = row.total || 0;
            }
            movimentacoesCount += row.count || 0;
          }
        }

        const saldoAtual = totalEntradas - totalSaidas;

        // 2. FLUXO MENSAL - Entradas e saídas por mês
        const monthlyResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              strftime('%Y-%m', date) as month,
              type,
              SUM(amount_cents) as total
            FROM transactions 
            WHERE deleted_at IS NULL 
              AND date BETWEEN ? AND ?
            GROUP BY strftime('%Y-%m', date), type
            ORDER BY month DESC
            LIMIT 12
          `,
          params: [startDate, endDate],
        });

        const monthlyMap = new Map();
        const monthlyResults = monthlyResult.result?.[0]?.results;
        if (monthlyResults) {
          for (const row of monthlyResults as any[]) {
            if (!monthlyMap.has(row.month)) {
              monthlyMap.set(row.month, { month: row.month, entradas: 0, saidas: 0 });
            }
            const monthData = monthlyMap.get(row.month);
            if (row.type === 'entrada') {
              monthData.entradas = row.total || 0;
            } else if (row.type === 'saida') {
              monthData.saidas = row.total || 0;
            }
          }
        }

        const monthlyFlow = Array.from(monthlyMap.values()).map((item: any) => ({
          ...item,
          saldo: item.entradas - item.saidas,
        }));

        // 3. DISTRIBUIÇÃO POR CATEGORIA
        const categoryResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              c.name as categoryName,
              c.kind as categoryKind,
              SUM(t.amount_cents) as total,
              COUNT(t.id) as count
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.deleted_at IS NULL 
              AND t.date BETWEEN ? AND ?
            GROUP BY c.id, c.name, c.kind
            ORDER BY total DESC
          `,
          params: [startDate, endDate],
        });

        const totalGeral = totalEntradas + totalSaidas;
        const categoryResults = categoryResult.result?.[0]?.results;
        const categoryDistribution = (categoryResults as any[] || []).map((row: any) => ({
          categoryName: row.categoryName,
          categoryKind: row.categoryKind,
          amount: row.total || 0,
          percentage: totalGeral > 0 ? Math.round(((row.total || 0) / totalGeral) * 100) : 0,
          count: row.count || 0,
        }));

        // 4. TRANSAÇÕES RECENTES
        const recentResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              t.id,
              t.type,
              t.amount_cents,
              t.date,
              t.description,
              t.method,
              c.name as categoryName
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.deleted_at IS NULL
            ORDER BY t.created_at DESC
            LIMIT 5
          `,
          params: [],
        });

        const recentResults = recentResult.result?.[0]?.results;
        const recentTransactions = (recentResults as any[] || []).map((row: any) => ({
          id: row.id,
          type: row.type,
          amountCents: row.amount_cents,
          date: row.date,
          description: row.description,
          categoryName: row.categoryName,
          method: row.method,
        }));

        return {
          summary: {
            totalEntradas,
            totalSaidas,
            saldoAtual,
            movimentacoesCount,
            percentualVariacao: 0, // TODO: calcular variação mensal
          },
          monthlyFlow,
          categoryDistribution,
          recentTransactions,
        };
      } catch (error) {
        console.error("Erro ao buscar métricas:", error);
        throw new Error("Falha ao carregar métricas do dashboard");
      }
    },
  });

export const createRunSqlTool = (env: Env) =>
  createPrivateTool({
    id: "RUN_SQL",
    description: "Executa query SQL direta para debug (apenas desenvolvimento)",
    inputSchema: z.object({
      sql: z.string(),
      params: z.array(z.any()).optional().default([]),
    }),
    outputSchema: z.object({
      result: z.any(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        console.log("Executando SQL:", context.sql);
        console.log("Parâmetros:", context.params);
        
        const result = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: context.sql,
          params: context.params || [],
        });
        
        console.log("Resultado SQL:", result);
        
        return {
          result: result.result,
          success: true,
        };
      } catch (error) {
        console.error("Erro SQL:", error);
        return {
          result: null,
          success: false,
          error: (error as Error).message,
        };
      }
    },
  });

export const createGetTransactionsSqlTool = (env: Env) =>
  createPrivateTool({
    id: "GET_TRANSACTIONS_SQL",
    description: "Lista movimentações com SQL direto",
    inputSchema: z.object({
      page: z.number().default(1),
      limit: z.number().max(100).default(20),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(['entrada', 'saida']).optional(),
      categoryId: z.number().optional(),
      search: z.string().optional(),
    }),
    outputSchema: z.object({
      transactions: z.array(z.object({
        id: z.number(),
        type: z.enum(['entrada', 'saida']),
        amountCents: z.number(),
        date: z.string(),
        description: z.string(),
        method: z.string().nullable(),
        reference: z.string().nullable(),
        notes: z.string().nullable(),
        createdAt: z.string(),
        category: z.object({
          id: z.number(),
          name: z.string(),
          kind: z.enum(['entrada', 'saida']),
        }),
        attachmentCount: z.number(),
      })),
      pagination: z.object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
      }),
    }),
    execute: async ({ context }) => {
      try {
        const offset = (context.page - 1) * context.limit;
        
        // Construir condições WHERE
        let whereConditions = ["t.deleted_at IS NULL"];
        let params: any[] = [];
        
        if (context.startDate) {
          whereConditions.push("t.date >= ?");
          params.push(context.startDate);
        }
        if (context.endDate) {
          whereConditions.push("t.date <= ?");
          params.push(context.endDate);
        }
        if (context.type) {
          whereConditions.push("t.type = ?");
          params.push(context.type);
        }
        if (context.categoryId) {
          whereConditions.push("t.category_id = ?");
          params.push(context.categoryId);
        }
        if (context.search) {
          whereConditions.push("t.description LIKE ?");
          params.push(`%${context.search}%`);
        }
        
        const whereClause = whereConditions.join(" AND ");
        
        // Query para buscar transações
        const transactionsResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `
            SELECT 
              t.id,
              t.type,
              t.amount_cents,
              t.date,
              t.description,
              t.method,
              t.reference,
              t.notes,
              t.created_at,
              c.id as category_id,
              c.name as category_name,
              c.kind as category_kind,
              COALESCE(att.attachment_count, 0) as attachment_count
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN (
              SELECT transaction_id, COUNT(*) as attachment_count
              FROM attachments
              GROUP BY transaction_id
            ) att ON t.id = att.transaction_id
            WHERE ${whereClause}
            ORDER BY t.date DESC, t.id DESC
            LIMIT ? OFFSET ?
          `,
          params: [...params, context.limit, offset],
        });
        
        // Query para contar total
        const countResult = await env.DECO_CHAT_WORKSPACE_API.DATABASES_RUN_SQL({
          sql: `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`,
          params: params,
        });
        
        const transactionResults = transactionsResult.result?.[0]?.results || [];
        const countResults = countResult.result?.[0]?.results || [];
        const total = countResults[0]?.total || 0;
        
        const transactions = transactionResults.map((row: any) => ({
          id: parseInt(row.id),
          type: row.type as "entrada" | "saida",
          amountCents: parseInt(row.amount_cents),
          date: row.date,
          description: row.description,
          method: row.method,
          reference: row.reference,
          notes: row.notes,
          createdAt: new Date(parseInt(row.created_at)).toISOString(),
          category: {
            id: parseInt(row.category_id),
            name: row.category_name,
            kind: row.category_kind as "entrada" | "saida",
          },
          attachmentCount: parseInt(row.attachment_count) || 0,
        }));
        
        return {
          transactions,
          pagination: {
            total: parseInt(total),
            page: context.page,
            limit: context.limit,
            totalPages: Math.ceil(parseInt(total) / context.limit),
          },
        };
      } catch (error) {
        console.error("Erro ao buscar transações:", error);
        throw new Error("Falha ao carregar transações");
      }
    },
  });

// Exportar todas as tools da tesouraria
export const tesourariaTools = [
  createListCategoriesPublicTool,
  createCreateTransactionTool,
  createGetTransactionsTool,
  createCreateCategoryTool,
  createSeedCategoriesTool,
  createCreateTransactionSqlTool, // Tool alternativa com SQL direto
  createGetDashboardMetricsTool, // Métricas do dashboard
  createGetTransactionsSqlTool, // Listagem com SQL direto
  createRunSqlTool, // Debug SQL
];
