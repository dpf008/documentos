/**
 * Template tools para o Sistema DeMolay
 * 
 * CRUD completo para gerenciar templates de documentos (convites, ofícios, etc.)
 * com placeholders dinâmicos, layout e corpo em Markdown.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db.ts";
import { templatesTable, letterheadsTable } from "../schema.ts";
import type { Env } from "../main.ts";

// Schema para placeholder
const PlaceholderSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "email", "url"]).default("text"),
  required: z.boolean().default(false),
  default: z.string().optional(),
});

// Schema para layout
const LayoutSchema = z.object({
  margins: z.object({
    top: z.number().default(72),
    right: z.number().default(72), 
    bottom: z.number().default(72),
    left: z.number().default(72),
  }).default({}),
  font: z.object({
    family: z.string().default("Arial"),
    size: z.number().default(12),
  }).default({}),
  alignment: z.enum(["left", "center", "right", "justify"]).default("left"),
});

// Schema para criação de template
const CreateTemplateSchema = z.object({
  type: z.enum(["convite", "oficio", "ata", "relatorio"]),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  letterheadId: z.number().int().positive().optional(),
  placeholders: z.array(PlaceholderSchema).default([]),
  layout: LayoutSchema.default({}),
  body: z.string().min(1, "Corpo do template é obrigatório"),
});

// Schema para atualização
const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema de resposta
const TemplateSchema = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  letterheadId: z.number().nullable(),
  letterheadName: z.string().nullable(), // Join com letterheads
  placeholders: z.array(PlaceholderSchema),
  layout: LayoutSchema,
  body: z.string(),
  version: z.number(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// CREATE - Criar novo template
export const createCreateTemplateTool = (env: Env) =>
  createTool({
    id: "CREATE_TEMPLATE",
    description: "Criar novo template de documento",
    inputSchema: CreateTemplateSchema,
    outputSchema: z.object({
      success: z.boolean(),
      template: TemplateSchema,
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se letterhead existe (se fornecido)
        if (context.letterheadId) {
          const letterhead = await db.select()
            .from(letterheadsTable)
            .where(and(
              eq(letterheadsTable.id, context.letterheadId),
              eq(letterheadsTable.active, 1)
            ))
            .limit(1);
            
          if (letterhead.length === 0) {
            throw new Error("Papel timbrado não encontrado ou inativo");
          }
        }

        const now = new Date();
        
        const result = await db.insert(templatesTable).values({
          type: context.type,
          name: context.name,
          description: context.description || null,
          letterheadId: context.letterheadId || null,
          placeholders: JSON.stringify(context.placeholders),
          layout: JSON.stringify(context.layout),
          body: context.body,
          version: 1,
          active: 1,
          createdAt: now,
          updatedAt: null,
        }).returning();

        const template = result[0];
        
        // Buscar nome do letterhead se existe
        let letterheadName = null;
        if (template.letterheadId) {
          const letterhead = await db.select({ name: letterheadsTable.name })
            .from(letterheadsTable)
            .where(eq(letterheadsTable.id, template.letterheadId))
            .limit(1);
          letterheadName = letterhead[0]?.name || null;
        }
        
        return {
          success: true,
          template: {
            id: template.id,
            type: template.type,
            name: template.name,
            description: template.description,
            letterheadId: template.letterheadId,
            letterheadName,
            placeholders: JSON.parse(template.placeholders || "[]"),
            layout: JSON.parse(template.layout || "{}"),
            body: template.body,
            version: template.version || 1,
            active: template.active === 1,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao criar template:", error);
        throw new Error(`Falha ao criar template: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// READ - Listar templates
export const createListTemplatesTool = (env: Env) =>
  createTool({
    id: "LIST_TEMPLATES",
    description: "Listar templates de documentos",
    inputSchema: z.object({
      type: z.enum(["convite", "oficio", "ata", "relatorio"]).optional(),
      activeOnly: z.boolean().default(true),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    outputSchema: z.object({
      templates: z.array(TemplateSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Construir query base
        const baseQuery = db.select({
          template: templatesTable,
          letterheadName: letterheadsTable.name,
        })
        .from(templatesTable)
        .leftJoin(letterheadsTable, eq(templatesTable.letterheadId, letterheadsTable.id));
        
        // Filtros
        const conditions = [];
        if (context.activeOnly) {
          conditions.push(eq(templatesTable.active, 1));
        }
        if (context.type) {
          conditions.push(eq(templatesTable.type, context.type));
        }
        
        let query = baseQuery;
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        const results = await query
          .orderBy(desc(templatesTable.createdAt))
          .limit(context.limit)
          .offset(context.offset);

        // Contar total
        const baseCountQuery = db.select({ count: templatesTable.id }).from(templatesTable);
        let countQuery = baseCountQuery;
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        const count = countResult.length;

        return {
          templates: results.map(r => ({
            id: r.template.id,
            type: r.template.type,
            name: r.template.name,
            description: r.template.description,
            letterheadId: r.template.letterheadId,
            letterheadName: r.letterheadName,
            placeholders: JSON.parse(r.template.placeholders || "[]"),
            layout: JSON.parse(r.template.layout || "{}"),
            body: r.template.body,
            version: r.template.version || 1,
            active: r.template.active === 1,
            createdAt: r.template.createdAt,
            updatedAt: r.template.updatedAt,
          })),
          total: count,
        };
      } catch (error) {
        console.error("Erro ao listar templates:", error);
        throw new Error("Falha ao listar templates");
      }
    },
  });

// READ - Obter template por ID
export const createGetTemplateTool = (env: Env) =>
  createTool({
    id: "GET_TEMPLATE",
    description: "Obter template por ID",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      template: TemplateSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select({
          template: templatesTable,
          letterheadName: letterheadsTable.name,
        })
        .from(templatesTable)
        .leftJoin(letterheadsTable, eq(templatesTable.letterheadId, letterheadsTable.id))
        .where(eq(templatesTable.id, context.id))
        .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            template: null,
          };
        }

        const r = result[0];
        
        return {
          success: true,
          template: {
            id: r.template.id,
            type: r.template.type,
            name: r.template.name,
            description: r.template.description,
            letterheadId: r.template.letterheadId,
            letterheadName: r.letterheadName,
            placeholders: JSON.parse(r.template.placeholders || "[]"),
            layout: JSON.parse(r.template.layout || "{}"),
            body: r.template.body,
            version: r.template.version || 1,
            active: r.template.active === 1,
            createdAt: r.template.createdAt,
            updatedAt: r.template.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter template:", error);
        throw new Error("Falha ao obter template");
      }
    },
  });

// UPDATE - Atualizar template
export const createUpdateTemplateTool = (env: Env) =>
  createTool({
    id: "UPDATE_TEMPLATE",
    description: "Atualizar template existente",
    inputSchema: UpdateTemplateSchema,
    outputSchema: z.object({
      success: z.boolean(),
      template: TemplateSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se template existe
        const existing = await db.select()
          .from(templatesTable)
          .where(eq(templatesTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Template não encontrado");
        }

        // Verificar letterhead se fornecido
        if (context.letterheadId) {
          const letterhead = await db.select()
            .from(letterheadsTable)
            .where(and(
              eq(letterheadsTable.id, context.letterheadId),
              eq(letterheadsTable.active, 1)
            ))
            .limit(1);
            
          if (letterhead.length === 0) {
            throw new Error("Papel timbrado não encontrado ou inativo");
          }
        }

        const now = new Date();
        const { id, placeholders, layout, ...updateData } = context;

        const updateValues: any = {
          ...updateData,
          updatedAt: now,
        };

        if (placeholders) {
          updateValues.placeholders = JSON.stringify(placeholders);
        }
        if (layout) {
          updateValues.layout = JSON.stringify(layout);
        }

        const result = await db.update(templatesTable)
          .set(updateValues)
          .where(eq(templatesTable.id, context.id))
          .returning();

        const template = result[0];

        // Buscar nome do letterhead se existe
        let letterheadName = null;
        if (template.letterheadId) {
          const letterhead = await db.select({ name: letterheadsTable.name })
            .from(letterheadsTable)
            .where(eq(letterheadsTable.id, template.letterheadId))
            .limit(1);
          letterheadName = letterhead[0]?.name || null;
        }

        return {
          success: true,
          template: {
            id: template.id,
            type: template.type,
            name: template.name,
            description: template.description,
            letterheadId: template.letterheadId,
            letterheadName,
            placeholders: JSON.parse(template.placeholders || "[]"),
            layout: JSON.parse(template.layout || "{}"),
            body: template.body,
            version: template.version || 1,
            active: template.active === 1,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar template:", error);
        throw new Error(`Falha ao atualizar template: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// DELETE - Desativar template (soft delete)
export const createDeactivateTemplateTool = (env: Env) =>
  createTool({
    id: "DEACTIVATE_TEMPLATE",
    description: "Desativar template (soft delete)",
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
          .from(templatesTable)
          .where(eq(templatesTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Template não encontrado");
        }

        const now = new Date();

        await db.update(templatesTable)
          .set({
            active: 0,
            updatedAt: now,
          })
          .where(eq(templatesTable.id, context.id));

        return {
          success: true,
          message: "Template desativado com sucesso",
        };
      } catch (error) {
        console.error("Erro ao desativar template:", error);
        throw new Error(`Falha ao desativar template: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Export all template tools
export const templateTools = [
  createCreateTemplateTool,
  createListTemplatesTool,
  createGetTemplateTool,
  createUpdateTemplateTool,
  createDeactivateTemplateTool,
];
