/**
 * Recipients (destinatários) tools para o Sistema DeMolay
 * 
 * CRUD completo para gerenciar destinatários de documentos
 * com suporte a tags e importação em lote.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { eq, desc, like, or, and } from "drizzle-orm";
import { getDb } from "../db.ts";
import { recipientsTable } from "../schema.ts";
import type { Env } from "../main.ts";

// Schema para criação de recipient
const CreateRecipientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  tags: z.array(z.string()).default([]),
});

// Schema para atualização
const UpdateRecipientSchema = CreateRecipientSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema para importação em lote
const ImportRecipientsSchema = z.object({
  recipients: z.array(CreateRecipientSchema).min(1, "Pelo menos um destinatário é obrigatório"),
  skipDuplicates: z.boolean().default(true),
});

// Schema de resposta
const RecipientSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  tags: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// CREATE - Criar novo recipient
export const createCreateRecipientTool = (env: Env) =>
  createTool({
    id: "CREATE_RECIPIENT",
    description: "Criar novo destinatário",
    inputSchema: CreateRecipientSchema,
    outputSchema: z.object({
      success: z.boolean(),
      recipient: RecipientSchema,
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se email já existe
        const existing = await db.select()
          .from(recipientsTable)
          .where(eq(recipientsTable.email, context.email))
          .limit(1);

        if (existing.length > 0) {
          throw new Error("Email já cadastrado");
        }

        const now = new Date();
        
        const result = await db.insert(recipientsTable).values({
          name: context.name,
          email: context.email,
          tags: JSON.stringify(context.tags),
          active: 1,
          createdAt: now,
          updatedAt: null,
        }).returning();

        const recipient = result[0];
        
        return {
          success: true,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            tags: JSON.parse(recipient.tags || "[]"),
            active: recipient.active === 1,
            createdAt: recipient.createdAt,
            updatedAt: recipient.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao criar recipient:", error);
        throw new Error(`Falha ao criar destinatário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// CREATE - Importar recipients em lote
export const createImportRecipientsTool = (env: Env) =>
  createTool({
    id: "IMPORT_RECIPIENTS",
    description: "Importar destinatários em lote",
    inputSchema: ImportRecipientsSchema,
    outputSchema: z.object({
      success: z.boolean(),
      imported: z.number(),
      skipped: z.number(),
      errors: z.array(z.object({
        email: z.string(),
        error: z.string(),
      })),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        let imported = 0;
        let skipped = 0;
        const errors: Array<{ email: string; error: string }> = [];

        for (const recipientData of context.recipients) {
          try {
            // Verificar se email já existe
            if (context.skipDuplicates) {
              const existing = await db.select()
                .from(recipientsTable)
                .where(eq(recipientsTable.email, recipientData.email))
                .limit(1);

              if (existing.length > 0) {
                skipped++;
                continue;
              }
            }

            const now = new Date();
            
            await db.insert(recipientsTable).values({
              name: recipientData.name,
              email: recipientData.email,
              tags: JSON.stringify(recipientData.tags),
              active: 1,
              createdAt: now,
              updatedAt: null,
            });

            imported++;
          } catch (error) {
            errors.push({
              email: recipientData.email,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            });
          }
        }

        return {
          success: true,
          imported,
          skipped,
          errors,
        };
      } catch (error) {
        console.error("Erro ao importar recipients:", error);
        throw new Error("Falha ao importar destinatários");
      }
    },
  });

// READ - Listar recipients
export const createListRecipientsTool = (env: Env) =>
  createTool({
    id: "LIST_RECIPIENTS",
    description: "Listar destinatários",
    inputSchema: z.object({
      search: z.string().optional(), // Busca por nome ou email
      tags: z.array(z.string()).default([]), // Filtrar por tags
      activeOnly: z.boolean().default(true),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    outputSchema: z.object({
      recipients: z.array(RecipientSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        let query = db.select().from(recipientsTable);
        
        // Construir condições de filtro
        const conditions = [];
        
        if (context.activeOnly) {
          conditions.push(eq(recipientsTable.active, 1));
        }
        
        if (context.search) {
          conditions.push(
            or(
              like(recipientsTable.name, `%${context.search}%`),
              like(recipientsTable.email, `%${context.search}%`)
            )
          );
        }
        
        // TODO: Filtro por tags (requer query mais complexa com JSON)
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        const recipients = await query
          .orderBy(desc(recipientsTable.createdAt))
          .limit(context.limit)
          .offset(context.offset);

        // Contar total
        let countQuery = db.select({ count: recipientsTable.id }).from(recipientsTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const [{ count }] = await countQuery;

        // Filtrar por tags no código (temporário até implementar query JSON)
        let filteredRecipients = recipients.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          tags: JSON.parse(r.tags || "[]"),
          active: r.active === 1,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

        if (context.tags.length > 0) {
          filteredRecipients = filteredRecipients.filter(r => 
            context.tags.some(tag => r.tags.includes(tag))
          );
        }

        return {
          recipients: filteredRecipients,
          total: count || 0,
        };
      } catch (error) {
        console.error("Erro ao listar recipients:", error);
        throw new Error("Falha ao listar destinatários");
      }
    },
  });

// READ - Obter recipient por ID
export const createGetRecipientTool = (env: Env) =>
  createTool({
    id: "GET_RECIPIENT",
    description: "Obter destinatário por ID",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      recipient: RecipientSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select()
          .from(recipientsTable)
          .where(eq(recipientsTable.id, context.id))
          .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            recipient: null,
          };
        }

        const recipient = result[0];
        
        return {
          success: true,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            tags: JSON.parse(recipient.tags || "[]"),
            active: recipient.active === 1,
            createdAt: recipient.createdAt,
            updatedAt: recipient.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter recipient:", error);
        throw new Error("Falha ao obter destinatário");
      }
    },
  });

// UPDATE - Atualizar recipient
export const createUpdateRecipientTool = (env: Env) =>
  createTool({
    id: "UPDATE_RECIPIENT",
    description: "Atualizar destinatário existente",
    inputSchema: UpdateRecipientSchema,
    outputSchema: z.object({
      success: z.boolean(),
      recipient: RecipientSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se existe
        const existing = await db.select()
          .from(recipientsTable)
          .where(eq(recipientsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Destinatário não encontrado");
        }

        // Verificar se email já existe em outro recipient
        if (context.email) {
          const emailExists = await db.select()
            .from(recipientsTable)
            .where(and(
              eq(recipientsTable.email, context.email),
              // Excluir o próprio recipient da verificação
              eq(recipientsTable.id, context.id)
            ))
            .limit(1);

          // Se encontrou algum resultado, significa que existe outro recipient com esse email
          if (emailExists.length === 0) {
            const otherWithEmail = await db.select()
              .from(recipientsTable)
              .where(eq(recipientsTable.email, context.email))
              .limit(1);
              
            if (otherWithEmail.length > 0) {
              throw new Error("Email já cadastrado para outro destinatário");
            }
          }
        }

        const now = new Date();
        const { id, tags, ...updateData } = context;

        const updateValues: any = {
          ...updateData,
          updatedAt: now,
        };

        if (tags) {
          updateValues.tags = JSON.stringify(tags);
        }

        const result = await db.update(recipientsTable)
          .set(updateValues)
          .where(eq(recipientsTable.id, context.id))
          .returning();

        const recipient = result[0];

        return {
          success: true,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            tags: JSON.parse(recipient.tags || "[]"),
            active: recipient.active === 1,
            createdAt: recipient.createdAt,
            updatedAt: recipient.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar recipient:", error);
        throw new Error(`Falha ao atualizar destinatário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// DELETE - Desativar recipient (soft delete)
export const createDeactivateRecipientTool = (env: Env) =>
  createTool({
    id: "DEACTIVATE_RECIPIENT",
    description: "Desativar destinatário (soft delete)",
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
          .from(recipientsTable)
          .where(eq(recipientsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Destinatário não encontrado");
        }

        const now = new Date();

        await db.update(recipientsTable)
          .set({
            active: 0,
            updatedAt: now,
          })
          .where(eq(recipientsTable.id, context.id));

        return {
          success: true,
          message: "Destinatário desativado com sucesso",
        };
      } catch (error) {
        console.error("Erro ao desativar recipient:", error);
        throw new Error(`Falha ao desativar destinatário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Export all recipient tools
export const recipientTools = [
  createCreateRecipientTool,
  createImportRecipientsTool,
  createListRecipientsTool,
  createGetRecipientTool,
  createUpdateRecipientTool,
  createDeactivateRecipientTool,
];
