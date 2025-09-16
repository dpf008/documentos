## Plano do Software de Tesouraria — Capítulo DeMolay

### Objetivo
Construir um sistema simples, seguro e auditável para gestão financeira do Capítulo DeMolay, focado em registro de movimentações (entradas/saídas), anexos de comprovantes, relatórios exportáveis e dashboards com gráficos, filtros e verificação de tendência.

### Perfis de Usuário (via Plataforma Deco)
- Tesoureiro: registra entradas/saídas, adiciona anexos, categoriza, gera relatórios.
- (Opcional) Conselho Fiscal/Mestre Conselheiro: visualização, filtros, exportações. Sem editar.
- Permissões gerenciadas pela plataforma Deco com createPrivateTool por ferramenta específica.

### Escopo Funcional (MVP)
- Cadastro de Movimentações
  - Campos: Tipo (Entrada/Saída), Valor (BRL), Data, Descrição, Categoria, Método de pagamento, Responsável/Referência, Observações, Anexos.
  - Validações: valor > 0; data obrigatória; limite de caracteres; categoria obrigatória.
- Anexos de Comprovantes
  - Upload de 1..N arquivos por movimentação; tipos permitidos: PDF, JPG/PNG, DOCX (configurável); limite de tamanho (ex.: 10MB/arquivo).
  - Pré-visualização (imagem) e link para download (PDF e outros).
- Listagem e Filtros
  - Tabela com paginação; filtros por: período, tipo, categoria, valor (faixa), método, texto livre (descrição).
- Relatórios Exportáveis
  - Relatório financeiro (período, agrupado por mês/categoria) com totais e saldo; exportar CSV e PDF.
- Dashboards
  - Gráficos: entradas/saídas por mês, distribuição por categoria, evolução do saldo.
  - Filtros: período, tipo, categoria, conta.
  - Tendências: média móvel, variação mensal, alertas simples (ex.: despesa fora da faixa padrão).
- Auditoria e Segurança
  - Log de criação/edição/exclusão; quem fez e quando.
  - Soft delete de movimentações; recuperação mediante permissão.
  - Controle de acesso por papel.

### Requisitos Não Funcionais
- Autenticação/autorização via Deco usando createPrivateTool; sem login próprio; papéis aplicados no servidor.
- Armazenamento de arquivos em provedor de objetos (Cloudflare R2 preferível no stack Workers; alternativa S3).
- LGPD: dados mínimos, controle de acesso, remoção mediante política.
- Observabilidade básica (logs) e backup/exportação periódica (CSV completo).

### Como implementar Anexos (passo a passo)
- Armazenamento: usar Cloudflare R2 (ou S3). O back-end gera URLs pré-assinadas (pre-signed URLs) para upload direto do navegador ao bucket.
- Fluxo:
  1) Usuário seleciona arquivos no formulário; front-end solicita ao servidor uma URL pré-assinada por arquivo (informando contentType, filename, tamanho).
  2) Front-end faz PUT do arquivo diretamente no R2 via URL pré-assinada.
  3) Ao concluir o upload, front-end envia ao servidor os metadados do anexo (storage_key, nome, tipo, tamanho) vinculando-os à movimentação.
- Validações e limites: extensões permitidas, tamanho máximo, quantidade máxima.
- Segurança: URLs de download sempre assinadas e com expiração; nunca expor o bucket público.
- (Opcional): varredura antivírus via serviço externo ou validação por tipo MIME/assinatura.

### Modelo de Dados (proposta)
- cash_accounts (opcional p/ separar caixa/banco): id, name, initial_balance_cents, created_at, active
- categories: id, name, kind (entrada|saida), active
- transactions:
  - id, account_id (fk), type (entrada|saida), amount_cents, date, description, category_id (fk), method, reference, notes, created_by (string - user ID da Deco), created_at, updated_at, deleted_at
- attachments: id, transaction_id (fk), filename, content_type, size_bytes, storage_key, uploaded_by (string - user ID da Deco), created_at
- audit_logs: id, entity (transaction|category|attachment), entity_id, action (create|update|delete|restore|export), actor_id (string - user ID da Deco), timestamp, diff (json)

Observações:
- Use valores monetários em centavos (amount_cents) para precisão.
- deleted_at habilita soft delete.
- Usuários vêm da plataforma Deco; IDs de usuário são strings fornecidas pelo contexto de autenticação.

### Fluxos Principais
- Criar Movimentação
  1) Preenche campos → valida → cria transaction.
  2) Para cada anexo: pede URL pré-assinada → faz upload → salva metadados em attachments.
- Listar/Filtrar: consulta paginada com filtros combináveis; ordenação por data/valor.
- Exportar Relatório: gera CSV (sempre) e PDF (quando solicitado) no servidor e disponibiliza para download.
- Dashboards: consultas agregadas por mês/categoria, com cálculo de médias móveis e variações.

### Relatórios (Especificação)
- Relatório Financeiro Mensal/Período
  - Colunas: Data, Tipo, Categoria, Descrição, Método, Valor, Responsável, Anexos (quantidade), Conta.
  - Totais: total de entradas, total de saídas, saldo inicial, saldo final do período.
  - Agrupamentos: por mês, por categoria.
  - Exportações: CSV (UTF-8, separador vírgula), PDF (layout A4, cabeçalho do Capítulo, período e totais).

### Dashboards e Tendências
- Gráficos: barras (entradas vs saídas por mês), pizza/barras (por categoria), linha (evolução do saldo).
- Indicadores: variação mensal (%), média móvel 3 meses, maiores 5 despesas do período.
- Alertas simples: despesa acima de limiar configurável; ausência de lançamento em período esperado.

## Implementação com Stack do Repositório

### Schema de Banco (server/schema.ts)
```typescript
// Usando Drizzle ORM + SQLite (Durable Objects)
import { integer, sqliteTable, text } from "@deco/workers-runtime/drizzle";

export const categoriesTable = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'entrada' | 'saida'
  active: integer("active").default(1), // boolean como integer
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

export const accountsTable = sqliteTable("accounts", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  initialBalanceCents: integer("initial_balance_cents").default(0),
  active: integer("active").default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

export const transactionsTable = sqliteTable("transactions", {
  id: integer("id").primaryKey(),
  accountId: integer("account_id").references(() => accountsTable.id),
  type: text("type").notNull(), // 'entrada' | 'saida'
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id).notNull(),
  method: text("method"), // 'dinheiro', 'pix', 'transferencia', 'cartao'
  reference: text("reference"), // responsável/referência
  notes: text("notes"),
  createdBy: text("created_by").notNull(), // user ID da Deco
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }),
  deletedAt: integer("deleted_at", { mode: 'timestamp' }),
});

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

export const auditLogsTable = sqliteTable("audit_logs", {
  id: integer("id").primaryKey(),
  entity: text("entity").notNull(), // 'transaction' | 'category' | 'attachment'
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // 'create' | 'update' | 'delete' | 'restore'
  actorId: text("actor_id").notNull(), // user ID da Deco
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  diff: text("diff"), // JSON com mudanças
});
```

### Tools Exportadas (server/tools/tesouraria.ts)
**Tools Públicas (sem autenticação):**
- `LIST_CATEGORIES_PUBLIC` - Lista categorias ativas para seleção

**Tools Privadas (com createPrivateTool):**
- `CREATE_TRANSACTION` - Cria nova movimentação financeira
- `GET_TRANSACTIONS` - Lista movimentações com filtros e paginação
- `UPDATE_TRANSACTION` - Atualiza movimentação existente
- `DELETE_TRANSACTION` - Soft delete de movimentação
- `GENERATE_UPLOAD_URL` - Gera URL pré-assinada para upload R2/S3
- `ATTACH_FILE_METADATA` - Salva metadados do anexo após upload
- `GET_ATTACHMENT_DOWNLOAD_URL` - URL assinada para download de anexo
- `EXPORT_REPORT` - Exporta relatório financeiro (CSV/PDF)
- `GET_DASHBOARD_METRICS` - Métricas agregadas para dashboard
- `CREATE_CATEGORY` - Cria nova categoria
- `UPDATE_CATEGORY` - Atualiza categoria existente

### Views/Páginas (view/src/routes/)
**Páginas Principais:**
- `/` - Dashboard com gráficos e métricas
- `/movimentacoes` - Listagem e criação de movimentações
- `/relatorios` - Geração e exportação de relatórios
- `/categorias` - Gerenciamento de categorias (admin)

**Componentes por Página:**
- **Dashboard**: DashboardCharts, MetricCards, QuickActions
- **Movimentações**: TransactionTable, CreateTransactionDialog, TransactionFilters, FileUploader
- **Relatórios**: ReportFilters, ReportPreview, ExportButtons
- **Categorias**: CategoryTable, CreateCategoryDialog

### Hooks TanStack Query (view/src/hooks/)
**Hooks de Dados:**
- `useTransactions(filters)` - useQuery para listagem com filtros
- `useTransaction(id)` - useQuery para movimentação específica
- `useDashboardMetrics(dateRange)` - useQuery para métricas do dashboard
- `useCategories()` - useQuery para lista de categorias

**Hooks de Mutação:**
- `useCreateTransaction()` - useMutation para criar movimentação
- `useUpdateTransaction()` - useMutation para atualizar movimentação
- `useDeleteTransaction()` - useMutation para deletar movimentação
- `useGenerateUploadUrl()` - useMutation para gerar URL de upload
- `useAttachFile()` - useMutation para salvar metadados de anexo
- `useExportReport()` - useMutation para exportar relatórios
- `useCreateCategory()` - useMutation para criar categoria

### Fluxo de Upload de Arquivos
1. **Frontend**: Usuário seleciona arquivo no FileUploader
2. **Frontend**: Chama `useGenerateUploadUrl.mutate({ filename, contentType, sizeBytes })`
3. **Backend**: Tool `GENERATE_UPLOAD_URL` valida e retorna URL pré-assinada
4. **Frontend**: Faz PUT direto no R2/S3 via URL pré-assinada
5. **Frontend**: Após upload, chama `useAttachFile.mutate({ transactionId, ...metadata })`
6. **Backend**: Tool `ATTACH_FILE_METADATA` salva registro na tabela attachments

### Estrutura de Arquivos
```
server/
├── schema.ts              # Schemas Drizzle ORM
├── db.ts                  # Conexão e migrações (getDb)
├── tools/
│   ├── index.ts           # Exporta todas as tools
│   └── tesouraria.ts      # Tools específicas da tesouraria
├── workflows/             # Workflows opcionais (futuro)
└── main.ts                # Registro de tools e runtime

view/
├── src/
│   ├── routes/
│   │   ├── index.tsx      # Dashboard (/)
│   │   ├── movimentacoes.tsx  # Movimentações
│   │   ├── relatorios.tsx     # Relatórios
│   │   └── categorias.tsx     # Categorias
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── TransactionTable.tsx
│   │   ├── CreateTransactionDialog.tsx
│   │   ├── TransactionFilters.tsx
│   │   ├── FileUploader.tsx
│   │   ├── DashboardCharts.tsx
│   │   └── ReportGenerator.tsx
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   ├── useCategories.ts
│   │   ├── useDashboard.ts
│   │   └── useFileUpload.ts
│   └── lib/
│       ├── rpc.ts         # Cliente RPC
│       ├── utils.ts       # Utilitários (cn, formatters)
│       └── constants.ts   # Constantes da aplicação
```

### Especificação do Formulário (UI/UX)
- Campos e máscaras:
  - Tipo: seletor (Entrada/Saída).
  - Valor: moeda BRL com máscara e armazenamento em centavos.
  - Data: datepicker (default hoje).
  - Descrição: texto curto (limite 140–255 chars).
  - Categoria: select com busca; criar rápida (se permitido) com validação de kind coerente.
  - Método: select (ex.: dinheiro, PIX, transferência, cartão).
  - Responsável/Referência: texto curto.
  - Observações: textarea opcional.
  - Anexos: arrastar-soltar + botão; feedback de progresso; remover antes de salvar.
- Acessibilidade: labels, mensagens de erro claras, foco, teclado.

### Regras e Validações de Negócio
- Não permitir type=entrada com categoria de saída (e vice-versa).
- Exigir ao menos uma categoria ativa.
- Impedir alterações em movimentações conciliadas (futuro).
- Soft delete com trilha de auditoria e restore apenas por admin.

### Segurança e Auditoria
- Autenticação/autorização via Deco (createPrivateTool) protegendo tools e workflows.
- Controle de acesso por papel; logs em audit_logs.
- URLs de download com expiração curta.
- Rate limit em uploads e exportações.

### Cronograma Detalhado (3 semanas — MVP)

**Semana 1: Fundação e CRUD Básico**
- Dia 1-2: Schema de banco (server/schema.ts), migrações, getDb setup
- Dia 3-4: Tools básicas (LIST_CATEGORIES_PUBLIC, CREATE_TRANSACTION, GET_TRANSACTIONS)
- Dia 5-7: Frontend básico (routes, hooks, componentes de listagem e criação)

**Semana 2: Upload, Relatórios e Dashboard**
- Dia 8-10: Sistema de upload (GENERATE_UPLOAD_URL, ATTACH_FILE_METADATA, FileUploader)
- Dia 11-12: Exportação de relatórios (EXPORT_REPORT, CSV/PDF generation)
- Dia 13-14: Dashboard e métricas (GET_DASHBOARD_METRICS, DashboardCharts)

**Semana 3: Polimento e Finalização**
- Dia 15-16: Auditoria e logs (auditLogsTable, logging em todas as tools)
- Dia 17-18: Validações, tratamento de erros, UX/UI polish
- Dia 19-21: Testes, documentação, deploy e configuração de permissões

### Critérios de Aceite (MVP)
- Registrar entrada/saída com anexos e ver na lista com filtros.
- Exportar relatório CSV/PDF por período com totais e saldo.
- Dashboard com ao menos 3 gráficos e filtros por período/categoria.
- Upload seguro (tipos/limite) e downloads com URL assinada.
- Logs mínimos de auditoria para criação/edição/exclusão.

### Riscos e Mitigações
- Volume de anexos: definir limites e limpeza/retenção.
- PDF server-side: usar biblioteca leve ou serviço externo.
- Conectividade móvel: manter salvamento progressivo e feedback.

### Evoluções Futuras
- Conciliação de conta (saldo reportado x sistema) e fechamentos.
- Plano de contas, centros de custo e orçamentos.
- Importação bancária (OFX/CSV) e categorização assistida.
- Notificações e lembretes.

### Especificações Técnicas Exemplificativas
- GENERATE_UPLOAD_URL (input): filename, contentType, sizeBytes, transactionId? (opcional antes de criar)
- ATTACH_FILE_METADATA (input): transactionId, filename, contentType, sizeBytes, storageKey
- EXPORT_REPORT (input): dateRange, groupBy (month|category), format (csv|pdf)

### Exemplo de Fluxo Real
Ex.: Entrada de R$ 100,00 (arrecadação de fundos) e saída de R$ 50,00 (filantropia). Registrar duas movimentações, anexar comprovantes (ex.: comprovante de PIX e nota), gerar relatório do mês para consolidar totais e visualizar no dashboard o saldo e categorias.
