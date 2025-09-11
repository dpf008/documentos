/**
 * Lists (listas de destinatários) tools para o Sistema DeMolay
 * 
 * CRUD completo para gerenciar listas de destinatários
 * com relacionamento N:N com recipients.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getDb } from "../db.ts";
import { listsTable, recipientsTable, listRecipientsTable } from "../schema.ts";
import type { Env } from "../main.ts";

// Schema para criação de list
const CreateListSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  recipientIds: z.array(z.number().int().positive()).default([]),
});

// Schema para atualização
const UpdateListSchema = CreateListSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema de recipient simplificado para resposta
const ListRecipientSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  tags: z.array(z.string()),
});

// Schema de resposta
const ListSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  recipientCount: z.number(),
  recipients: z.array(ListRecipientSchema).optional(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});


// CREATE - Criar nova list
export const createCreateListTool = (env: Env) =>
  createTool({
    id: "CREATE_LIST",
    description: "Criar nova lista de destinatários",
    inputSchema: CreateListSchema,
    outputSchema: z.object({
      success: z.boolean(),
      list: ListSchema,
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se recipients existem (se fornecidos)
        if (context.recipientIds.length > 0) {
          const recipients = await db.select({ id: recipientsTable.id })
            .from(recipientsTable)
            .where(and(
              inArray(recipientsTable.id, context.recipientIds),
              eq(recipientsTable.active, 1)
            ));
            
          if (recipients.length !== context.recipientIds.length) {
            throw new Error("Um ou mais destinatários não foram encontrados ou estão inativos");
          }
        }

        const now = new Date();
        
        // Criar lista
        const result = await db.insert(listsTable).values({
          name: context.name,
          description: context.description || null,
          active: 1,
          createdAt: now,
          updatedAt: null,
        }).returning();

        const list = result[0];
        
        // Adicionar recipients à lista
        if (context.recipientIds.length > 0) {
          const listRecipientEntries = context.recipientIds.map(recipientId => ({
            listId: list.id,
            recipientId,
            addedAt: now,
          }));
          
          await db.insert(listRecipientsTable).values(listRecipientEntries);
        }

        return {
          success: true,
          list: {
            id: list.id,
            name: list.name,
            description: list.description,
            recipientCount: context.recipientIds.length,
            active: list.active === 1,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao criar list:", error);
        throw new Error(`Falha ao criar lista: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// READ - Listar lists
export const createListListsTool = (env: Env) =>
  createTool({
    id: "LIST_LISTS",
    description: "Listar listas de destinatários",
    inputSchema: z.object({
      activeOnly: z.boolean().default(true),
      includeRecipients: z.boolean().default(false),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    outputSchema: z.object({
      lists: z.array(ListSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const baseQuery = db.select().from(listsTable);
        const conditions = [];
        
        if (context.activeOnly) {
          conditions.push(eq(listsTable.active, 1));
        }
        
        let query = baseQuery;
        if (conditions.length > 0) {
          query = query.where(conditions[0]);
        }
        
        const lists = await query
          .orderBy(desc(listsTable.createdAt))
          .limit(context.limit)
          .offset(context.offset);

        // Contar total
        const baseCountQuery = db.select({ count: listsTable.id }).from(listsTable);
        let countQuery = baseCountQuery;
        if (conditions.length > 0) {
          countQuery = countQuery.where(conditions[0]);
        }
        const countResult = await countQuery;
        const count = countResult.length;

        // Buscar contagem de recipients para cada lista
        const listIds = lists.map(l => l.id);
        const recipientCounts = await db.select({
          listId: listRecipientsTable.listId,
          count: listRecipientsTable.recipientId,
        })
        .from(listRecipientsTable)
        .where(inArray(listRecipientsTable.listId, listIds));

        // Agrupar contagens por lista
        const countsByList = recipientCounts.reduce((acc, curr) => {
          acc[curr.listId] = (acc[curr.listId] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        // Buscar recipients se solicitado
        let recipientsByList: Record<number, any[]> = {};
        if (context.includeRecipients) {
          const recipientsData = await db.select({
            listId: listRecipientsTable.listId,
            recipient: recipientsTable,
          })
          .from(listRecipientsTable)
          .innerJoin(recipientsTable, eq(listRecipientsTable.recipientId, recipientsTable.id))
          .where(and(
            inArray(listRecipientsTable.listId, listIds),
            eq(recipientsTable.active, 1)
          ));

          // Agrupar recipients por lista
          recipientsByList = recipientsData.reduce((acc, curr) => {
            if (!acc[curr.listId]) acc[curr.listId] = [];
            acc[curr.listId].push({
              id: curr.recipient.id,
              name: curr.recipient.name,
              email: curr.recipient.email,
              tags: JSON.parse(curr.recipient.tags || "[]"),
            });
            return acc;
          }, {} as Record<number, any[]>);
        }

        return {
          lists: lists.map(l => ({
            id: l.id,
            name: l.name,
            description: l.description,
            recipientCount: countsByList[l.id] || 0,
            recipients: context.includeRecipients ? recipientsByList[l.id] || [] : undefined,
            active: l.active === 1,
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
          })),
          total: count,
        };
      } catch (error) {
        console.error("Erro ao listar lists:", error);
        throw new Error("Falha ao listar listas");
      }
    },
  });

// READ - Obter list por ID
export const createGetListTool = (env: Env) =>
  createTool({
    id: "GET_LIST",
    description: "Obter lista por ID",
    inputSchema: z.object({
      id: z.number().int().positive(),
      includeRecipients: z.boolean().default(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      list: ListSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select()
          .from(listsTable)
          .where(eq(listsTable.id, context.id))
          .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            list: null,
          };
        }

        const list = result[0];

        // Buscar recipients da lista
        let recipients: any[] = [];
        if (context.includeRecipients) {
          const recipientsData = await db.select({
            recipient: recipientsTable,
          })
          .from(listRecipientsTable)
          .innerJoin(recipientsTable, eq(listRecipientsTable.recipientId, recipientsTable.id))
          .where(and(
            eq(listRecipientsTable.listId, context.id),
            eq(recipientsTable.active, 1)
          ));

          recipients = recipientsData.map(r => ({
            id: r.recipient.id,
            name: r.recipient.name,
            email: r.recipient.email,
            tags: JSON.parse(r.recipient.tags || "[]"),
          }));
        }
        
        return {
          success: true,
          list: {
            id: list.id,
            name: list.name,
            description: list.description,
            recipientCount: recipients.length,
            recipients: context.includeRecipients ? recipients : undefined,
            active: list.active === 1,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter list:", error);
        throw new Error("Falha ao obter lista");
      }
    },
  });

// UPDATE - Atualizar list
export const createUpdateListTool = (env: Env) =>
  createTool({
    id: "UPDATE_LIST",
    description: "Atualizar lista existente",
    inputSchema: UpdateListSchema,
    outputSchema: z.object({
      success: z.boolean(),
      list: ListSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se lista existe
        const existing = await db.select()
          .from(listsTable)
          .where(eq(listsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Lista não encontrada");
        }

        // Verificar recipients se fornecidos
        if (context.recipientIds && context.recipientIds.length > 0) {
          const recipients = await db.select({ id: recipientsTable.id })
            .from(recipientsTable)
            .where(and(
              inArray(recipientsTable.id, context.recipientIds),
              eq(recipientsTable.active, 1)
            ));
            
          if (recipients.length !== context.recipientIds.length) {
            throw new Error("Um ou mais destinatários não foram encontrados ou estão inativos");
          }
        }

        const now = new Date();
        const { id, recipientIds, ...updateData } = context;

        // Atualizar lista
        const result = await db.update(listsTable)
          .set({
            ...updateData,
            updatedAt: now,
          })
          .where(eq(listsTable.id, context.id))
          .returning();

        const list = result[0];

        // Atualizar recipients se fornecidos
        if (recipientIds !== undefined) {
          // Remover todos os recipients atuais
          await db.delete(listRecipientsTable)
            .where(eq(listRecipientsTable.listId, context.id));

          // Adicionar novos recipients
          if (recipientIds.length > 0) {
            const listRecipientEntries = recipientIds.map(recipientId => ({
              listId: context.id,
              recipientId,
              addedAt: now,
            }));
            
            await db.insert(listRecipientsTable).values(listRecipientEntries);
          }
        }

        return {
          success: true,
          list: {
            id: list.id,
            name: list.name,
            description: list.description,
            recipientCount: recipientIds?.length || 0,
            active: list.active === 1,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar list:", error);
        throw new Error(`Falha ao atualizar lista: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Adicionar recipients a uma lista
export const createAddRecipientsToListTool = (env: Env) =>
  createTool({
    id: "ADD_RECIPIENTS_TO_LIST",
    description: "Adicionar destinatários a uma lista",
    inputSchema: z.object({
      listId: z.number().int().positive(),
      recipientIds: z.array(z.number().int().positive()).min(1),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      added: z.number(),
      skipped: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se lista existe
        const list = await db.select()
          .from(listsTable)
          .where(eq(listsTable.id, context.listId))
          .limit(1);

        if (list.length === 0) {
          throw new Error("Lista não encontrada");
        }

        // Verificar quais recipients já estão na lista
        const existing = await db.select({ recipientId: listRecipientsTable.recipientId })
          .from(listRecipientsTable)
          .where(and(
            eq(listRecipientsTable.listId, context.listId),
            inArray(listRecipientsTable.recipientId, context.recipientIds)
          ));

        const existingIds = existing.map(e => e.recipientId);
        const newRecipientIds = context.recipientIds.filter(id => !existingIds.includes(id));

        // Verificar se os novos recipients existem e estão ativos
        if (newRecipientIds.length > 0) {
          const recipients = await db.select({ id: recipientsTable.id })
            .from(recipientsTable)
            .where(and(
              inArray(recipientsTable.id, newRecipientIds),
              eq(recipientsTable.active, 1)
            ));
            
          const validIds = recipients.map(r => r.id);
          const invalidIds = newRecipientIds.filter(id => !validIds.includes(id));
          
          if (invalidIds.length > 0) {
            throw new Error(`Destinatários não encontrados ou inativos: ${invalidIds.join(', ')}`);
          }

          // Adicionar novos recipients
          const now = new Date();
          const listRecipientEntries = validIds.map(recipientId => ({
            listId: context.listId,
            recipientId,
            addedAt: now,
          }));
          
          await db.insert(listRecipientsTable).values(listRecipientEntries);
        }

        return {
          success: true,
          added: newRecipientIds.length,
          skipped: existingIds.length,
        };
      } catch (error) {
        console.error("Erro ao adicionar recipients à list:", error);
        throw new Error(`Falha ao adicionar destinatários à lista: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Remover recipients de uma lista
export const createRemoveRecipientsFromListTool = (env: Env) =>
  createTool({
    id: "REMOVE_RECIPIENTS_FROM_LIST",
    description: "Remover destinatários de uma lista",
    inputSchema: z.object({
      listId: z.number().int().positive(),
      recipientIds: z.array(z.number().int().positive()).min(1),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      removed: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se lista existe
        const list = await db.select()
          .from(listsTable)
          .where(eq(listsTable.id, context.listId))
          .limit(1);

        if (list.length === 0) {
          throw new Error("Lista não encontrada");
        }

        // Remover recipients da lista
        const result = await db.delete(listRecipientsTable)
          .where(and(
            eq(listRecipientsTable.listId, context.listId),
            inArray(listRecipientsTable.recipientId, context.recipientIds)
          ));

        return {
          success: true,
          removed: context.recipientIds.length,
        };
      } catch (error) {
        console.error("Erro ao remover recipients da list:", error);
        throw new Error(`Falha ao remover destinatários da lista: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// DELETE - Desativar list (soft delete)
export const createDeactivateListTool = (env: Env) =>
  createTool({
    id: "DEACTIVATE_LIST",
    description: "Desativar lista (soft delete)",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se existe
        const existing = await db.select()
          .from(listsTable)
          .where(eq(listsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Lista não encontrada");
        }

        const now = new Date();

        await db.update(listsTable)
          .set({
            active: 0,
            updatedAt: now,
          })
          .where(eq(listsTable.id, context.id));

        return {
          success: true,
          message: "Lista desativada com sucesso",
        };
      } catch (error) {
        console.error("Erro ao desativar list:", error);
        throw new Error(`Falha ao desativar lista: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Export all list tools
export const listTools = [
  createCreateListTool,
  createListListsTool,
  createGetListTool,
  createUpdateListTool,
  createAddRecipientsToListTool,
  createRemoveRecipientsFromListTool,
  createDeactivateListTool,
];
