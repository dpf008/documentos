/**
 * Letterhead (papel timbrado) tools para o Sistema DeMolay
 * 
 * CRUD completo para gerenciar papéis timbrados (PDFs, PNGs, SVGs)
 * que serão usados como base para gerar documentos.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.ts";
import { letterheadsTable } from "../schema.ts";
import type { Env } from "../main.ts";

// Schema para criação de letterhead
const CreateLetterheadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  fileUrl: z.string().url("URL do arquivo inválida"),
  fileType: z.enum(["pdf", "png", "svg"], { 
    errorMap: () => ({ message: "Tipo deve ser: pdf, png ou svg" })
  }),
  pages: z.number().int().positive().default(1),
});

// Schema para atualização
const UpdateLetterheadSchema = CreateLetterheadSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema de resposta
const LetterheadSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  fileUrl: z.string(),
  fileType: z.string(),
  pages: z.number(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// CREATE - Criar novo letterhead
export const createCreateLetterheadTool = (env: Env) =>
  createTool({
    id: "CREATE_LETTERHEAD",
    description: "Criar novo papel timbrado",
    inputSchema: CreateLetterheadSchema,
    outputSchema: z.object({
      success: z.boolean(),
      letterhead: LetterheadSchema,
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const now = new Date();
        
        const result = await db.insert(letterheadsTable).values({
          name: context.name,
          description: context.description || null,
          fileUrl: context.fileUrl,
          fileType: context.fileType,
          pages: context.pages,
          active: 1,
          createdAt: now,
          updatedAt: null,
        }).returning();

        const letterhead = result[0];
        
        return {
          success: true,
          letterhead: {
            id: letterhead.id,
            name: letterhead.name,
            description: letterhead.description,
            fileUrl: letterhead.fileUrl,
            fileType: letterhead.fileType,
            pages: letterhead.pages || 1,
            active: letterhead.active === 1,
            createdAt: letterhead.createdAt,
            updatedAt: letterhead.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao criar letterhead:", error);
        throw new Error("Falha ao criar papel timbrado");
      }
    },
  });

// READ - Listar letterheads
export const createListLetterheadsTool = (env: Env) =>
  createTool({
    id: "LIST_LETTERHEADS",
    description: "Listar todos os papéis timbrados",
    inputSchema: z.object({
      activeOnly: z.boolean().default(true),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    outputSchema: z.object({
      letterheads: z.array(LetterheadSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        let letterheads;
        let count = 0;
        
        if (context.activeOnly) {
          letterheads = await db.select()
            .from(letterheadsTable)
            .where(eq(letterheadsTable.active, 1))
            .orderBy(desc(letterheadsTable.createdAt))
            .limit(context.limit)
            .offset(context.offset);
            
          const countResult = await db.select({ count: letterheadsTable.id })
            .from(letterheadsTable)
            .where(eq(letterheadsTable.active, 1));
          count = countResult.length;
        } else {
          letterheads = await db.select()
            .from(letterheadsTable)
            .orderBy(desc(letterheadsTable.createdAt))
            .limit(context.limit)
            .offset(context.offset);
            
          const countResult = await db.select({ count: letterheadsTable.id })
            .from(letterheadsTable);
          count = countResult.length;
        }

        return {
          letterheads: letterheads.map(l => ({
            id: l.id,
            name: l.name,
            description: l.description,
            fileUrl: l.fileUrl,
            fileType: l.fileType,
            pages: l.pages || 1,
            active: l.active === 1,
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
          })),
          total: count || 0,
        };
      } catch (error) {
        console.error("Erro ao listar letterheads:", error);
        throw new Error("Falha ao listar papéis timbrados");
      }
    },
  });

// READ - Obter letterhead por ID
export const createGetLetterheadTool = (env: Env) =>
  createTool({
    id: "GET_LETTERHEAD",
    description: "Obter papel timbrado por ID",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      letterhead: LetterheadSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select()
          .from(letterheadsTable)
          .where(eq(letterheadsTable.id, context.id))
          .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            letterhead: null,
          };
        }

        const letterhead = result[0];
        
        return {
          success: true,
          letterhead: {
            id: letterhead.id,
            name: letterhead.name,
            description: letterhead.description,
            fileUrl: letterhead.fileUrl,
            fileType: letterhead.fileType,
            pages: letterhead.pages || 1,
            active: letterhead.active === 1,
            createdAt: letterhead.createdAt,
            updatedAt: letterhead.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter letterhead:", error);
        throw new Error("Falha ao obter papel timbrado");
      }
    },
  });

// UPDATE - Atualizar letterhead
export const createUpdateLetterheadTool = (env: Env) =>
  createTool({
    id: "UPDATE_LETTERHEAD",
    description: "Atualizar papel timbrado existente",
    inputSchema: UpdateLetterheadSchema,
    outputSchema: z.object({
      success: z.boolean(),
      letterhead: LetterheadSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se existe
        const existing = await db.select()
          .from(letterheadsTable)
          .where(eq(letterheadsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Papel timbrado não encontrado");
        }

        const now = new Date();
        const { id, ...updateData } = context;

        const result = await db.update(letterheadsTable)
          .set({
            ...updateData,
            updatedAt: now,
          })
          .where(eq(letterheadsTable.id, context.id))
          .returning();

        const letterhead = result[0];

        return {
          success: true,
          letterhead: {
            id: letterhead.id,
            name: letterhead.name,
            description: letterhead.description,
            fileUrl: letterhead.fileUrl,
            fileType: letterhead.fileType,
            pages: letterhead.pages || 1,
            active: letterhead.active === 1,
            createdAt: letterhead.createdAt,
            updatedAt: letterhead.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar letterhead:", error);
        throw new Error(`Falha ao atualizar papel timbrado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// DELETE - Desativar letterhead (soft delete)
export const createDeactivateLetterheadTool = (env: Env) =>
  createTool({
    id: "DEACTIVATE_LETTERHEAD",
    description: "Desativar papel timbrado (soft delete)",
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
          .from(letterheadsTable)
          .where(eq(letterheadsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Papel timbrado não encontrado");
        }

        const now = new Date();

        await db.update(letterheadsTable)
          .set({
            active: 0,
            updatedAt: now,
          })
          .where(eq(letterheadsTable.id, context.id));

        return {
          success: true,
          message: "Papel timbrado desativado com sucesso",
        };
      } catch (error) {
        console.error("Erro ao desativar letterhead:", error);
        throw new Error(`Falha ao desativar papel timbrado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// DELETE - Reativar letterhead
export const createReactivateLetterheadTool = (env: Env) =>
  createTool({
    id: "REACTIVATE_LETTERHEAD",
    description: "Reativar papel timbrado",
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
          .from(letterheadsTable)
          .where(eq(letterheadsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Papel timbrado não encontrado");
        }

        const now = new Date();

        await db.update(letterheadsTable)
          .set({
            active: 1,
            updatedAt: now,
          })
          .where(eq(letterheadsTable.id, context.id));

        return {
          success: true,
          message: "Papel timbrado reativado com sucesso",
        };
      } catch (error) {
        console.error("Erro ao reativar letterhead:", error);
        throw new Error(`Falha ao reativar papel timbrado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Export all letterhead tools
export const letterheadTools = [
  createCreateLetterheadTool,
  createListLetterheadsTool,
  createGetLetterheadTool,
  createUpdateLetterheadTool,
  createDeactivateLetterheadTool,
  createReactivateLetterheadTool,
];
