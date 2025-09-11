/**
 * Documents (convites/ofícios instanciados) tools para o Sistema DeMolay
 * 
 * CRUD completo para gerenciar documentos instanciados a partir de templates,
 * com renderização HTML, placeholders preenchidos e links públicos.
 * 
 * TODO: Geração de PDF (pdf-lib não funciona em Workers - avaliar alternativas)
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { eq, desc, and, like, or } from "drizzle-orm";
import { getDb } from "../db.ts";
import { documentsTable, templatesTable, letterheadsTable } from "../schema.ts";
import type { Env } from "../main.ts";

// Schema para valores de placeholders
const PlaceholderValueSchema = z.record(z.string(), z.any());

// Schema para criação de document
const CreateDocumentSchema = z.object({
  templateId: z.number().int().positive(),
  letterheadOverrideId: z.number().int().positive().optional(),
  title: z.string().min(1, "Título é obrigatório"),
  placeholdersFilled: PlaceholderValueSchema.default({}),
  isPublic: z.boolean().default(false),
  createdBy: z.string().optional(),
});

// Schema para atualização
const UpdateDocumentSchema = CreateDocumentSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema de resposta
const DocumentSchema = z.object({
  id: z.number(),
  templateId: z.number(),
  templateName: z.string(),
  templateType: z.string(),
  letterheadOverrideId: z.number().nullable(),
  title: z.string(),
  bodyRendered: z.string(),
  bodySource: z.string(),
  placeholdersFilled: PlaceholderValueSchema,
  pdfUrl: z.string().nullable(),
  publicSlug: z.string().nullable(),
  publicUrl: z.string().nullable(), // URL completa para acesso público
  isPublic: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// Função para gerar slug único
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens duplos
    .trim()
    .substring(0, 50) + '-' + Date.now().toString(36);
}

// Função para renderizar markdown simples para HTML
function renderMarkdownToHtml(markdown: string, placeholders: Record<string, any>): string {
  let html = markdown;
  
  // Substituir placeholders
  Object.entries(placeholders).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    html = html.replace(new RegExp(placeholder, 'g'), String(value || ''));
  });
  
  // Conversões básicas de markdown para HTML
  html = html
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // Envolver em parágrafos
  if (!html.startsWith('<h') && !html.startsWith('<p>')) {
    html = '<p>' + html;
  }
  if (!html.endsWith('</h1>') && !html.endsWith('</h2>') && !html.endsWith('</h3>') && !html.endsWith('</p>')) {
    html = html + '</p>';
  }
  
  return html;
}

// CREATE - Criar novo document
export const createCreateDocumentTool = (env: Env) =>
  createTool({
    id: "CREATE_DOCUMENT",
    description: "Criar novo documento a partir de template",
    inputSchema: CreateDocumentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      document: DocumentSchema,
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se template existe e está ativo
        const template = await db.select()
          .from(templatesTable)
          .where(and(
            eq(templatesTable.id, context.templateId),
            eq(templatesTable.active, 1)
          ))
          .limit(1);

        if (template.length === 0) {
          throw new Error("Template não encontrado ou inativo");
        }

        // Verificar letterhead override se fornecido
        if (context.letterheadOverrideId) {
          const letterhead = await db.select()
            .from(letterheadsTable)
            .where(and(
              eq(letterheadsTable.id, context.letterheadOverrideId),
              eq(letterheadsTable.active, 1)
            ))
            .limit(1);
            
          if (letterhead.length === 0) {
            throw new Error("Papel timbrado de override não encontrado ou inativo");
          }
        }

        const templateData = template[0];
        const now = new Date();
        
        // Renderizar HTML a partir do markdown do template
        const bodyRendered = renderMarkdownToHtml(templateData.body, context.placeholdersFilled);
        
        // Gerar slug público se documento for público
        const publicSlug = context.isPublic ? generateSlug(context.title) : null;
        
        const result = await db.insert(documentsTable).values({
          templateId: context.templateId,
          letterheadOverrideId: context.letterheadOverrideId || null,
          title: context.title,
          bodyRendered,
          bodySource: templateData.body,
          placeholdersFilled: JSON.stringify(context.placeholdersFilled),
          pdfUrl: null, // TODO: Implementar geração de PDF
          publicSlug,
          isPublic: context.isPublic ? 1 : 0,
          createdBy: context.createdBy || null,
          createdAt: now,
          updatedAt: null,
        }).returning();

        const document = result[0];
        
        // Construir URL pública se aplicável
        const publicUrl = publicSlug ? `/convites/${document.id}/${publicSlug}` : null;
        
        return {
          success: true,
          document: {
            id: document.id,
            templateId: document.templateId,
            templateName: templateData.name,
            templateType: templateData.type,
            letterheadOverrideId: document.letterheadOverrideId,
            title: document.title,
            bodyRendered: document.bodyRendered,
            bodySource: document.bodySource,
            placeholdersFilled: JSON.parse(document.placeholdersFilled || "{}"),
            pdfUrl: document.pdfUrl,
            publicSlug: document.publicSlug,
            publicUrl,
            isPublic: document.isPublic === 1,
            createdBy: document.createdBy,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao criar document:", error);
        throw new Error(`Falha ao criar documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// READ - Listar documents
export const createListDocumentsTool = (env: Env) =>
  createTool({
    id: "LIST_DOCUMENTS",
    description: "Listar documentos",
    inputSchema: z.object({
      templateType: z.enum(["convite", "oficio", "ata", "relatorio"]).optional(),
      search: z.string().optional(), // Busca por título
      isPublic: z.boolean().optional(),
      createdBy: z.string().optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    outputSchema: z.object({
      documents: z.array(DocumentSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Query base com join no template
        let query = db.select({
          document: documentsTable,
          templateName: templatesTable.name,
          templateType: templatesTable.type,
        })
        .from(documentsTable)
        .innerJoin(templatesTable, eq(documentsTable.templateId, templatesTable.id));
        
        // Construir condições de filtro
        const conditions = [];
        
        if (context.templateType) {
          conditions.push(eq(templatesTable.type, context.templateType));
        }
        
        if (context.search) {
          conditions.push(like(documentsTable.title, `%${context.search}%`));
        }
        
        if (context.isPublic !== undefined) {
          conditions.push(eq(documentsTable.isPublic, context.isPublic ? 1 : 0));
        }
        
        if (context.createdBy) {
          conditions.push(eq(documentsTable.createdBy, context.createdBy));
        }
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        const results = await query
          .orderBy(desc(documentsTable.createdAt))
          .limit(context.limit)
          .offset(context.offset);

        // Contar total
        let countQuery = db.select({ count: documentsTable.id })
          .from(documentsTable)
          .innerJoin(templatesTable, eq(documentsTable.templateId, templatesTable.id));
          
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const [{ count }] = await countQuery;

        return {
          documents: results.map(r => {
            const publicUrl = r.document.publicSlug ? `/convites/${r.document.id}/${r.document.publicSlug}` : null;
            
            return {
              id: r.document.id,
              templateId: r.document.templateId,
              templateName: r.templateName,
              templateType: r.templateType,
              letterheadOverrideId: r.document.letterheadOverrideId,
              title: r.document.title,
              bodyRendered: r.document.bodyRendered,
              bodySource: r.document.bodySource,
              placeholdersFilled: JSON.parse(r.document.placeholdersFilled || "{}"),
              pdfUrl: r.document.pdfUrl,
              publicSlug: r.document.publicSlug,
              publicUrl,
              isPublic: r.document.isPublic === 1,
              createdBy: r.document.createdBy,
              createdAt: r.document.createdAt,
              updatedAt: r.document.updatedAt,
            };
          }),
          total: count || 0,
        };
      } catch (error) {
        console.error("Erro ao listar documents:", error);
        throw new Error("Falha ao listar documentos");
      }
    },
  });

// READ - Obter document por ID
export const createGetDocumentTool = (env: Env) =>
  createTool({
    id: "GET_DOCUMENT",
    description: "Obter documento por ID",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      document: DocumentSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select({
          document: documentsTable,
          templateName: templatesTable.name,
          templateType: templatesTable.type,
        })
        .from(documentsTable)
        .innerJoin(templatesTable, eq(documentsTable.templateId, templatesTable.id))
        .where(eq(documentsTable.id, context.id))
        .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            document: null,
          };
        }

        const r = result[0];
        const publicUrl = r.document.publicSlug ? `/convites/${r.document.id}/${r.document.publicSlug}` : null;
        
        return {
          success: true,
          document: {
            id: r.document.id,
            templateId: r.document.templateId,
            templateName: r.templateName,
            templateType: r.templateType,
            letterheadOverrideId: r.document.letterheadOverrideId,
            title: r.document.title,
            bodyRendered: r.document.bodyRendered,
            bodySource: r.document.bodySource,
            placeholdersFilled: JSON.parse(r.document.placeholdersFilled || "{}"),
            pdfUrl: r.document.pdfUrl,
            publicSlug: r.document.publicSlug,
            publicUrl,
            isPublic: r.document.isPublic === 1,
            createdBy: r.document.createdBy,
            createdAt: r.document.createdAt,
            updatedAt: r.document.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter document:", error);
        throw new Error("Falha ao obter documento");
      }
    },
  });

// READ - Obter document por slug público
export const createGetDocumentBySlugTool = (env: Env) =>
  createTool({
    id: "GET_DOCUMENT_BY_SLUG",
    description: "Obter documento por slug público",
    inputSchema: z.object({
      id: z.number().int().positive(),
      slug: z.string().min(1),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      document: DocumentSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        const result = await db.select({
          document: documentsTable,
          templateName: templatesTable.name,
          templateType: templatesTable.type,
        })
        .from(documentsTable)
        .innerJoin(templatesTable, eq(documentsTable.templateId, templatesTable.id))
        .where(and(
          eq(documentsTable.id, context.id),
          eq(documentsTable.publicSlug, context.slug),
          eq(documentsTable.isPublic, 1)
        ))
        .limit(1);

        if (result.length === 0) {
          return {
            success: false,
            document: null,
          };
        }

        const r = result[0];
        const publicUrl = `/convites/${r.document.id}/${r.document.publicSlug}`;
        
        return {
          success: true,
          document: {
            id: r.document.id,
            templateId: r.document.templateId,
            templateName: r.templateName,
            templateType: r.templateType,
            letterheadOverrideId: r.document.letterheadOverrideId,
            title: r.document.title,
            bodyRendered: r.document.bodyRendered,
            bodySource: r.document.bodySource,
            placeholdersFilled: JSON.parse(r.document.placeholdersFilled || "{}"),
            pdfUrl: r.document.pdfUrl,
            publicSlug: r.document.publicSlug,
            publicUrl,
            isPublic: true,
            createdBy: r.document.createdBy,
            createdAt: r.document.createdAt,
            updatedAt: r.document.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao obter document por slug:", error);
        throw new Error("Falha ao obter documento público");
      }
    },
  });

// UPDATE - Atualizar document
export const createUpdateDocumentTool = (env: Env) =>
  createTool({
    id: "UPDATE_DOCUMENT",
    description: "Atualizar documento existente",
    inputSchema: UpdateDocumentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      document: DocumentSchema.nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      try {
        // Verificar se document existe
        const existing = await db.select()
          .from(documentsTable)
          .where(eq(documentsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Documento não encontrado");
        }

        // Verificar template se fornecido
        if (context.templateId) {
          const template = await db.select()
            .from(templatesTable)
            .where(and(
              eq(templatesTable.id, context.templateId),
              eq(templatesTable.active, 1)
            ))
            .limit(1);

          if (template.length === 0) {
            throw new Error("Template não encontrado ou inativo");
          }
        }

        // Verificar letterhead override se fornecido
        if (context.letterheadOverrideId) {
          const letterhead = await db.select()
            .from(letterheadsTable)
            .where(and(
              eq(letterheadsTable.id, context.letterheadOverrideId),
              eq(letterheadsTable.active, 1)
            ))
            .limit(1);
            
          if (letterhead.length === 0) {
            throw new Error("Papel timbrado de override não encontrado ou inativo");
          }
        }

        const now = new Date();
        const { id, placeholdersFilled, isPublic, title, ...updateData } = context;

        const updateValues: any = {
          ...updateData,
          updatedAt: now,
        };

        // Se placeholders foram alterados ou template mudou, re-renderizar
        let shouldRerender = false;
        if (placeholdersFilled || context.templateId) {
          shouldRerender = true;
          
          // Buscar template atual ou novo
          const templateId = context.templateId || existing[0].templateId;
          const template = await db.select()
            .from(templatesTable)
            .where(eq(templatesTable.id, templateId))
            .limit(1);
            
          if (template.length > 0) {
            const finalPlaceholders = placeholdersFilled || JSON.parse(existing[0].placeholdersFilled || "{}");
            updateValues.bodyRendered = renderMarkdownToHtml(template[0].body, finalPlaceholders);
            updateValues.bodySource = template[0].body;
            updateValues.placeholdersFilled = JSON.stringify(finalPlaceholders);
          }
        }

        // Atualizar slug público se título ou status público mudou
        if ((title && title !== existing[0].title) || (isPublic !== undefined && isPublic !== (existing[0].isPublic === 1))) {
          const finalTitle = title || existing[0].title;
          const finalIsPublic = isPublic !== undefined ? isPublic : (existing[0].isPublic === 1);
          
          updateValues.publicSlug = finalIsPublic ? generateSlug(finalTitle) : null;
          updateValues.isPublic = finalIsPublic ? 1 : 0;
          
          if (title) {
            updateValues.title = title;
          }
        }

        const result = await db.update(documentsTable)
          .set(updateValues)
          .where(eq(documentsTable.id, context.id))
          .returning();

        const document = result[0];

        // Buscar dados do template para resposta
        const template = await db.select()
          .from(templatesTable)
          .where(eq(templatesTable.id, document.templateId))
          .limit(1);

        const publicUrl = document.publicSlug ? `/convites/${document.id}/${document.publicSlug}` : null;

        return {
          success: true,
          document: {
            id: document.id,
            templateId: document.templateId,
            templateName: template[0]?.name || '',
            templateType: template[0]?.type || '',
            letterheadOverrideId: document.letterheadOverrideId,
            title: document.title,
            bodyRendered: document.bodyRendered,
            bodySource: document.bodySource,
            placeholdersFilled: JSON.parse(document.placeholdersFilled || "{}"),
            pdfUrl: document.pdfUrl,
            publicSlug: document.publicSlug,
            publicUrl,
            isPublic: document.isPublic === 1,
            createdBy: document.createdBy,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar document:", error);
        throw new Error(`Falha ao atualizar documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// TODO: Tool para gerar PDF
export const createGenerateDocumentPdfTool = (env: Env) =>
  createTool({
    id: "GENERATE_DOCUMENT_PDF",
    description: "Gerar PDF do documento (TODO: implementar)",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      pdfUrl: z.string().nullable(),
    }),
    execute: async ({ context }) => {
      // TODO: Implementar geração de PDF
      // Alternativas: Cloudflare Browser Rendering, serviço externo, etc.
      
      return {
        success: false,
        message: "Geração de PDF ainda não implementada (pdf-lib não funciona em Workers)",
        pdfUrl: null,
      };
    },
  });

// DELETE - Deletar document (hard delete)
export const createDeleteDocumentTool = (env: Env) =>
  createTool({
    id: "DELETE_DOCUMENT",
    description: "Deletar documento permanentemente",
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
          .from(documentsTable)
          .where(eq(documentsTable.id, context.id))
          .limit(1);

        if (existing.length === 0) {
          throw new Error("Documento não encontrado");
        }

        // TODO: Deletar arquivo PDF se existir

        await db.delete(documentsTable).where(eq(documentsTable.id, context.id));

        return {
          success: true,
          message: "Documento deletado com sucesso",
        };
      } catch (error) {
        console.error("Erro ao deletar document:", error);
        throw new Error(`Falha ao deletar documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
  });

// Export all document tools
export const documentTools = [
  createCreateDocumentTool,
  createListDocumentsTool,
  createGetDocumentTool,
  createGetDocumentBySlugTool,
  createUpdateDocumentTool,
  createGenerateDocumentPdfTool,
  createDeleteDocumentTool,
];
