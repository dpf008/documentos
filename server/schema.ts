/**
 * Schema para o Sistema de Tesouraria do Capítulo DeMolay
 * 
 * Entidades principais:
 * - Categories (categorias de entrada/saída)
 * - Accounts (contas - caixa, banco)
 * - Transactions (movimentações financeiras)
 * - Attachments (anexos/comprovantes)
 * - AuditLogs (logs de auditoria)
 *
 * Após modificações, execute `npm run db:generate` para gerar migration.
 */
import { integer, sqliteTable, text } from "@deco/workers-runtime/drizzle";

// Categorias de movimentação financeira
export const categoriesTable = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'entrada' | 'saida'
  active: integer("active").default(1), // boolean como integer (0/1)
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Contas (caixa, banco) - opcional para separar diferentes fontes
export const accountsTable = sqliteTable("accounts", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  initialBalanceCents: integer("initial_balance_cents").default(0),
  active: integer("active").default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Movimentações financeiras (entradas e saídas)
export const transactionsTable = sqliteTable("transactions", {
  id: integer("id").primaryKey(),
  accountId: integer("account_id").references(() => accountsTable.id),
  type: text("type").notNull(), // 'entrada' | 'saida'
  amountCents: integer("amount_cents").notNull(), // valor em centavos
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id).notNull(),
  method: text("method"), // 'dinheiro', 'pix', 'transferencia', 'cartao'
  reference: text("reference"), // responsável/referência
  notes: text("notes"),
  createdBy: text("created_by").notNull(), // user ID da Deco
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
  deletedAt: integer("deleted_at", { mode: 'timestamp' }), // soft delete
});

// Anexos/comprovantes das movimentações
export const attachmentsTable = sqliteTable("attachments", {
  id: integer("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactionsTable.id).notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(), // chave no R2/S3
  uploadedBy: text("uploaded_by").notNull(), // user ID da Deco
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Logs de auditoria para rastreabilidade
export const auditLogsTable = sqliteTable("audit_logs", {
  id: integer("id").primaryKey(),
  entity: text("entity").notNull(), // 'transaction' | 'category' | 'attachment'
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // 'create' | 'update' | 'delete' | 'restore'
  actorId: text("actor_id").notNull(), // user ID da Deco
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  diff: text("diff"), // JSON com mudanças (opcional)
});

// Tabela legacy (manter por enquanto)
export const todosTable = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title"),
  completed: integer("completed").default(0),
});
