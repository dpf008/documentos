/**
 * Schema para o Sistema Operacional do Capítulo DeMolay
 * 
 * Entidades principais:
 * - Letterhead (papel timbrado)
 * - Template (modelos de documentos)
 * - Document (convites/ofícios instanciados)
 * - Recipient (destinatários)
 * - List (listas de destinatários)
 * - EmailSend (logs de envio)
 *
 * Após modificações, execute `npm run db:generate` para gerar migration.
 */
import { integer, sqliteTable, text, real } from "@deco/workers-runtime/drizzle";

// Papel timbrado (PDFs, PNGs, SVGs)
export const letterheadsTable = sqliteTable("letterheads", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(), // URL do arquivo no R2/FS
  fileType: text("file_type").notNull(), // "pdf" | "png" | "svg"
  pages: integer("pages").default(1), // número de páginas (para PDFs)
  active: integer("active").default(1), // 0 = inativo, 1 = ativo
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
});

// Templates de documentos
export const templatesTable = sqliteTable("templates", {
  id: integer("id").primaryKey(),
  type: text("type").notNull(), // "convite" | "oficio" | "ata" | "relatorio"
  name: text("name").notNull(),
  description: text("description"),
  letterheadId: integer("letterhead_id").references(() => letterheadsTable.id),
  
  // Placeholders como JSON: [{ id, label, type, required, default }]
  placeholders: text("placeholders").notNull().default("[]"),
  
  // Layout como JSON: { margins, font, sizes, alignments }
  layout: text("layout").notNull().default("{}"),
  
  // Corpo do template em Markdown
  body: text("body").notNull().default(""),
  
  version: integer("version").default(1),
  active: integer("active").default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
});

// Documentos instanciados (convites, ofícios)
export const documentsTable = sqliteTable("documents", {
  id: integer("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  letterheadOverrideId: integer("letterhead_override_id").references(() => letterheadsTable.id),
  
  title: text("title").notNull(),
  bodyRendered: text("body_rendered").notNull(), // HTML renderizado
  bodySource: text("body_source").notNull(), // Markdown fonte
  placeholdersFilled: text("placeholders_filled").notNull().default("{}"), // JSON dos valores
  
  pdfUrl: text("pdf_url"), // URL do PDF gerado (opcional)
  publicSlug: text("public_slug"), // slug para URL pública
  isPublic: integer("is_public").default(0), // 0 = privado, 1 = público
  
  createdBy: text("created_by"), // usuário que criou
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
});

// Destinatários
export const recipientsTable = sqliteTable("recipients", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  tags: text("tags").default("[]"), // JSON array de tags
  active: integer("active").default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
});

// Listas de destinatários
export const listsTable = sqliteTable("lists", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: integer("active").default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
});

// Relacionamento N:N entre listas e destinatários
export const listRecipientsTable = sqliteTable("list_recipients", {
  id: integer("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => listsTable.id),
  recipientId: integer("recipient_id").notNull().references(() => recipientsTable.id),
  addedAt: integer("added_at", { mode: 'timestamp' }).notNull(),
});

// Logs de envio de email
export const emailSendsTable = sqliteTable("email_sends", {
  id: integer("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id),
  recipientId: integer("recipient_id").notNull().references(() => recipientsTable.id),
  
  status: text("status").notNull(), // "pending" | "sent" | "failed" | "bounced"
  messageId: text("message_id"), // ID da mensagem do provedor de email
  subject: text("subject"),
  
  sentAt: integer("sent_at", { mode: 'timestamp' }),
  error: text("error"), // mensagem de erro se falhou
  
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Tabela legacy (manter por enquanto)
export const todosTable = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title"),
  completed: integer("completed").default(0),
});
