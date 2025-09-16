# Sistema de Gestão de Comandas - Feijoada DeMolay

## Objetivo
Desenvolver um sistema integrado de gestão de comandas para eventos do Capítulo DeMolay (feijoadas, noites de sobremesas, etc.), permitindo controle digital das vendas, consumo por mesa e integração automática com o sistema de tesouraria existente.

## Contexto do Negócio
- **Eventos**: Feijoadas, noites de sobremesas e outros eventos sociais
- **Público**: Tios maçons e suas famílias
- **Operação**: Membros do capítulo servem e vendem itens no salão da loja
- **Processo Atual**: Comandas manuais em papel + planilha para controle de itens
- **Integração**: Sistema conectado ao módulo @tesouraria/ para registro automático das vendas

## Funcionalidades Principais → Tools

### 1. Configuração de Evento
- **CREATE_EVENT** - Criar novo evento com data, tipo e configurações
- **UPDATE_EVENT** - Atualizar informações do evento
- **CLOSE_EVENT** - Finalizar evento e gerar relatório consolidado
- **GET_ACTIVE_EVENT** - Obter evento ativo atual

### 2. Gestão de Cardápio
- **CREATE_MENU_ITEM** - Cadastrar item do cardápio (nome, preço, categoria, disponível)
- **UPDATE_MENU_ITEM** - Atualizar item do cardápio
- **TOGGLE_ITEM_AVAILABILITY** - Ativar/desativar item durante o evento
- **GET_MENU_ITEMS** - Listar itens do cardápio com filtros

### 3. Gestão de Comandas (Administrativo)
- **CREATE_COMANDA** - Criar nova comanda para mesa/cliente
- **GET_COMANDAS** - Listar comandas abertas/fechadas com filtros
- **ADD_ITEM_TO_COMANDA** - Adicionar item à comanda
- **REMOVE_ITEM_FROM_COMANDA** - Remover item da comanda
- **UPDATE_ITEM_QUANTITY** - Atualizar quantidade de item na comanda
- **CLOSE_COMANDA** - Fechar comanda e processar pagamento
- **REOPEN_COMANDA** - Reabrir comanda fechada (se necessário)
- **GET_COMANDA_DETAILS** - Detalhes completos de uma comanda

### 4. Autoatendimento (Cliente)
- **AUTHENTICATE_COMANDA** - Autenticar cliente com número da comanda
- **GET_MY_COMANDA** - Ver própria comanda (itens e total)
- **ADD_ITEM_SELF_SERVICE** - Cliente adiciona item à própria comanda
- **REQUEST_ASSISTANCE** - Solicitar ajuda/atendimento

### 5. Relatórios e Integração
- **GET_EVENT_SUMMARY** - Resumo financeiro do evento
- **SYNC_TO_TREASURY** - Sincronizar vendas com sistema de tesouraria
- **GET_SALES_REPORT** - Relatório detalhado de vendas por período
- **GET_ITEM_PERFORMANCE** - Performance de vendas por item

## Fontes de Dados → MCPs/Dependências

### Integração com Sistema de Tesouraria
- **@tesouraria/CREATE_TRANSACTION** - Registrar receitas do evento
- **@tesouraria/LIST_CATEGORIES_PUBLIC** - Categorias para classificação das vendas
- **@tesouraria/GET_DASHBOARD_METRICS** - Métricas financeiras integradas

### Dados Internos (SQLite)
- **Eventos** - Configurações e status dos eventos
- **Cardápio** - Itens disponíveis para venda
- **Comandas** - Pedidos e consumo por mesa/cliente
- **Itens da Comanda** - Detalhamento dos pedidos
- **Sessões de Autoatendimento** - Controle de acesso cliente

## Estruturas de Dados → Schemas do Banco de Dados

```typescript
// server/schema.ts - Extensão para módulo de comandas

export const eventsTable = sqliteTable("events", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(), // "Feijoada de Março 2024"
  type: text("type").notNull(), // "feijoada" | "sobremesa" | "jantar"
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"), // HH:MM
  endTime: text("end_time"), // HH:MM
  status: text("status").default("planned"), // "planned" | "active" | "closed"
  maxTables: integer("max_tables").default(50),
  allowSelfService: integer("allow_self_service").default(1), // boolean
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  closedAt: integer("closed_at", { mode: 'timestamp' }),
});

export const menuItemsTable = sqliteTable("menu_items", {
  id: integer("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id),
  name: text("name").notNull(), // "Feijoada Completa"
  description: text("description"), // "Com linguiça, bacon, carne seca..."
  category: text("category").notNull(), // "prato_principal" | "bebida" | "sobremesa"
  priceCents: integer("price_cents").notNull(),
  available: integer("available").default(1), // boolean
  maxQuantity: integer("max_quantity"), // limite por comanda
  imageUrl: text("image_url"), // opcional
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

export const comandasTable = sqliteTable("comandas", {
  id: integer("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id).notNull(),
  number: integer("number").notNull(), // Número da mesa/comanda
  customerName: text("customer_name"), // Nome do cliente (opcional)
  status: text("status").default("open"), // "open" | "closed" | "cancelled"
  totalCents: integer("total_cents").default(0),
  paymentMethod: text("payment_method"), // "dinheiro" | "pix" | "cartao"
  notes: text("notes"), // Observações especiais
  openedAt: integer("opened_at", { mode: 'timestamp' }).notNull(),
  closedAt: integer("closed_at", { mode: 'timestamp' }),
  closedBy: text("closed_by"), // ID do usuário que fechou
  createdBy: text("created_by").notNull(),
});

export const comandaItemsTable = sqliteTable("comanda_items", {
  id: integer("id").primaryKey(),
  comandaId: integer("comanda_id").references(() => comandasTable.id).notNull(),
  menuItemId: integer("menu_item_id").references(() => menuItemsTable.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(), // Preço no momento da venda
  totalCents: integer("total_cents").notNull(),
  notes: text("notes"), // "Sem bacon", "Extra molho"
  addedAt: integer("added_at", { mode: 'timestamp' }).notNull(),
  addedBy: text("added_by").notNull(), // "member" | "self_service"
});

export const selfServiceSessionsTable = sqliteTable("self_service_sessions", {
  id: integer("id").primaryKey(),
  comandaId: integer("comanda_id").references(() => comandasTable.id).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  lastAccessAt: integer("last_access_at", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Extensão da tabela de categorias para incluir vendas de eventos
// (usar categorias existentes do sistema de tesouraria)
```

## Workflows Vitais → Workflows

### 1. Workflow de Abertura de Evento
```typescript
const createEventSetupWorkflow = (env: Env) => {
  const createEventStep = createStepFromTool(createEventTool(env));
  const setupMenuStep = createStepFromTool(setupMenuTool(env));
  const validateSetupStep = createStepFromTool(validateEventSetupTool(env));

  return createWorkflow({
    id: "EVENT_SETUP",
    inputSchema: z.object({
      name: z.string(),
      type: z.string(),
      date: z.string(),
      menuItems: z.array(z.object({
        name: z.string(),
        priceCents: z.number(),
        category: z.string()
      }))
    }),
    outputSchema: z.object({
      eventId: z.number(),
      menuCount: z.number(),
      ready: z.boolean()
    }),
  })
    .then(createEventStep)
    .map((context) => ({
      ...context,
      eventId: context.eventId,
      menuItems: context.menuItems
    }))
    .then(setupMenuStep)
    .then(validateSetupStep)
    .commit();
};
```

### 2. Workflow de Fechamento de Comanda
```typescript
const createCloseComandaWorkflow = (env: Env) => {
  const calculateTotalStep = createStepFromTool(calculateComandaTotalTool(env));
  const processPaymentStep = createStepFromTool(processPaymentTool(env));
  const syncToTreasuryStep = createStepFromTool(syncToTreasuryTool(env));

  return createWorkflow({
    id: "CLOSE_COMANDA",
    inputSchema: z.object({
      comandaId: z.number(),
      paymentMethod: z.string(),
      notes: z.string().optional()
    }),
    outputSchema: z.object({
      comandaId: z.number(),
      totalCents: z.number(),
      treasuryTransactionId: z.number().optional(),
      success: z.boolean()
    }),
  })
    .then(calculateTotalStep)
    .then(processPaymentStep)
    .then(syncToTreasuryStep)
    .commit();
};
```

### 3. Workflow de Fechamento de Evento
```typescript
const createCloseEventWorkflow = (env: Env) => {
  const closeOpenComandasStep = createStepFromTool(closeOpenComandasTool(env));
  const generateSummaryStep = createStepFromTool(generateEventSummaryTool(env));
  const syncAllToTreasuryStep = createStepFromTool(syncAllToTreasuryTool(env));

  return createWorkflow({
    id: "CLOSE_EVENT",
    inputSchema: z.object({
      eventId: z.number(),
      forceClose: z.boolean().default(false)
    }),
    outputSchema: z.object({
      eventId: z.number(),
      totalRevenueCents: z.number(),
      totalComandas: z.number(),
      openComandas: z.number(),
      treasurySynced: z.boolean()
    }),
  })
    .then(closeOpenComandasStep)
    .then(generateSummaryStep)
    .then(syncAllToTreasuryStep)
    .commit();
};
```

## Interação do Usuário → Views

### 1. Dashboard Administrativo (`/comandas`)
**Componentes:**
- **EventHeader** - Status do evento atual, botões de ação
- **QuickStats** - Cards com métricas rápidas (comandas abertas, faturamento, item mais vendido)
- **ComandaGrid** - Grid de comandas abertas com status visual
- **QuickActions** - Botões para ações rápidas (nova comanda, fechar evento)

**Layout:**
```
┌─────────────────────────────────────────┐
│ [Feijoada Mar/2024] [Status: Ativo]    │
│ [Nova Comanda] [Cardápio] [Fechar]      │
├─────────────────────────────────────────┤
│ 📊 15 Abertas │ 💰 R$ 1.250 │ 🍽️ Feijoada │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ 01  │ │ 02  │ │ 03  │ │ 04  │        │
│ │R$45 │ │R$78 │ │R$32 │ │R$91 │        │
│ │🟢   │ │🟡   │ │🟢   │ │🔴   │        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│ [+ Nova] [Relatório] [Configurações]    │
└─────────────────────────────────────────┘
```

### 2. Gestão de Comanda Individual (`/comandas/:id`)
**Componentes:**
- **ComandaHeader** - Número, cliente, status, total
- **ItemsList** - Lista de itens com quantidade e preços
- **AddItemSection** - Busca e adição de itens do cardápio
- **PaymentSection** - Finalização e formas de pagamento

**Layout:**
```
┌─────────────────────────────────────────┐
│ Comanda #15 - João Silva                │
│ Status: Aberta │ Total: R$ 67,50        │
├─────────────────────────────────────────┤
│ ✓ 1x Feijoada Completa    R$ 25,00     │
│ ✓ 2x Refrigerante         R$ 12,00     │
│ ✓ 1x Sobremesa           R$ 15,00      │
│ ✓ 1x Caipirinha          R$ 15,50     │
├─────────────────────────────────────────┤
│ [Buscar Item.....................] [+]  │
│ 🍽️ Pratos │ 🥤 Bebidas │ 🍰 Sobremesas    │
├─────────────────────────────────────────┤
│ [💰 Dinheiro] [💳 PIX] [💳 Cartão]      │
│ [Fechar Comanda] [Imprimir] [Cancelar]  │
└─────────────────────────────────────────┘
```

### 3. Configuração de Evento (`/comandas/evento`)
**Componentes:**
- **EventForm** - Dados básicos do evento
- **MenuManager** - Gestão do cardápio
- **EventSettings** - Configurações avançadas

**Layout:**
```
┌─────────────────────────────────────────┐
│ 📅 Novo Evento                          │
│ Nome: [Feijoada de Abril 2024........] │
│ Tipo: [Feijoada ▼] Data: [15/04/2024]  │
│ Mesas: [50] Autoatendimento: [✓]       │
├─────────────────────────────────────────┤
│ 🍽️ Cardápio                            │
│ ┌─ Feijoada Completa ─ R$ 25,00 ─ [✓]┐ │
│ ┌─ Refrigerante ─────── R$ 6,00 ── [✓]┐ │
│ ┌─ Caipirinha ──────── R$ 15,00 ─ [✓]┐ │
│ [+ Adicionar Item]                      │
├─────────────────────────────────────────┤
│ [Salvar Evento] [Cancelar] [Ativar]     │
└─────────────────────────────────────────┘
```

### 4. Autoatendimento - Autenticação (`/self-service`)
**Componentes:**
- **ComandaAuth** - Input do número da comanda
- **EventInfo** - Informações do evento atual

**Layout:**
```
┌─────────────────────────────────────────┐
│          🎉 Feijoada DeMolay           │
│             15 de Abril 2024            │
├─────────────────────────────────────────┤
│         Acesse sua Comanda              │
│                                         │
│    [____________________]               │
│     Digite o número da mesa             │
│                                         │
│         [Acessar Comanda]               │
│                                         │
│  ❓ Precisa de ajuda? Chame um membro   │
└─────────────────────────────────────────┘
```

### 5. Autoatendimento - Minha Comanda (`/self-service/:token`)
**Componentes:**
- **MyComandaHeader** - Número da mesa e total
- **MyItemsList** - Itens já pedidos
- **MenuBrowser** - Cardápio para adicionar itens
- **HelpButton** - Solicitar ajuda

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🏠 Mesa 15                Total: R$ 45,00│
├─────────────────────────────────────────┤
│ Seus Pedidos:                           │
│ ✓ 1x Feijoada Completa    R$ 25,00     │
│ ✓ 2x Refrigerante         R$ 12,00     │
│ ✓ 1x Sobremesa           R$ 8,00       │
├─────────────────────────────────────────┤
│ 🍽️ Adicionar mais:                     │
│ ┌─ Caipirinha ─────── R$ 15,00 ─ [+] ┐  │
│ ┌─ Cerveja ─────────── R$ 8,00 ─ [+] ┐  │
│ ┌─ Pudim ──────────── R$ 10,00 ─ [+] ┐  │
├─────────────────────────────────────────┤
│ [🆘 Chamar Atendente] [🔄 Atualizar]   │
└─────────────────────────────────────────┘
```

### 6. Relatórios do Evento (`/comandas/relatorios`)
**Componentes:**
- **EventSummary** - Resumo financeiro
- **ItemsReport** - Performance por item
- **ComandasReport** - Detalhes por comanda
- **TreasuryIntegration** - Status da sincronização

**Layout:**
```
┌─────────────────────────────────────────┐
│ 📊 Relatório - Feijoada Mar/2024       │
├─────────────────────────────────────────┤
│ 💰 Faturamento Total: R$ 2.850,00      │
│ 🍽️ Comandas Fechadas: 45/47           │
│ ⏰ Duração: 14:00 - 18:30              │
├─────────────────────────────────────────┤
│ 🏆 Itens Mais Vendidos:                │
│ 1. Feijoada Completa (38 vendas)       │
│ 2. Refrigerante (72 vendas)            │
│ 3. Caipirinha (25 vendas)              │
├─────────────────────────────────────────┤
│ 🔄 Integração Tesouraria: ✅ Sincronizado│
│ ID Transação: #1247                     │
├─────────────────────────────────────────┤
│ [Exportar PDF] [Exportar CSV] [Email]   │
└─────────────────────────────────────────┘
```

## Fluxos de Trabalho Detalhados

### Fluxo 1: Setup do Evento
1. **Configuração**: Membro cria evento em `/comandas/evento`
2. **Cardápio**: Define itens, preços e disponibilidade
3. **Ativação**: Evento fica ativo para receber comandas
4. **Preparação**: Sistema gera números de mesa/comanda

### Fluxo 2: Operação Durante o Evento
1. **Nova Comanda**: Membro cria comanda para mesa/cliente
2. **Adição de Itens**: Itens são adicionados conforme pedidos
3. **Autoatendimento**: Clientes podem adicionar itens via app
4. **Fechamento**: Comanda é fechada com forma de pagamento

### Fluxo 3: Autoatendimento do Cliente
1. **Acesso**: Cliente digita número da mesa em `/self-service`
2. **Autenticação**: Sistema gera token temporário
3. **Navegação**: Cliente vê cardápio e adiciona itens
4. **Confirmação**: Itens são adicionados à comanda automaticamente

### Fluxo 4: Fechamento do Evento
1. **Encerramento**: Membro fecha evento no dashboard
2. **Comandas Abertas**: Sistema alerta sobre comandas em aberto
3. **Relatório**: Geração automática do relatório consolidado
4. **Integração**: Sincronização automática com sistema de tesouraria

## Integração com Sistema de Tesouraria

### Sincronização Automática
```typescript
// Quando uma comanda é fechada
const syncComandaToTreasury = async (comandaId: number) => {
  const comanda = await getComandaDetails(comandaId);
  
  // Cria transação de entrada na tesouraria
  await env.SELF.CREATE_TRANSACTION({
    type: "entrada",
    amountCents: comanda.totalCents,
    date: new Date().toISOString().split('T')[0],
    description: `Comanda #${comanda.number} - ${comanda.eventName}`,
    categoryId: CATEGORIA_VENDAS_EVENTO, // Categoria pré-configurada
    method: comanda.paymentMethod,
    reference: `Evento: ${comanda.eventName}`,
    notes: `Mesa ${comanda.number} - ${comanda.customerName || 'Cliente não identificado'}`,
    createdBy: "sistema_comandas"
  });
};
```

### Categorias Específicas
- **"Vendas - Feijoada"** - Receitas de eventos de feijoada
- **"Vendas - Sobremesas"** - Receitas de noites de sobremesa  
- **"Vendas - Eventos Diversos"** - Outras atividades

## Considerações Técnicas

### Segurança
- **Autoatendimento**: Tokens temporários com expiração (2 horas)
- **Autenticação Admin**: Integração com sistema de permissões Deco
- **Validações**: Prevenção de manipulação de preços e quantidades

### Performance
- **Cache**: Menu items em cache durante evento ativo
- **Otimização**: Queries otimizadas para dashboard em tempo real
- **Offline**: Funcionamento básico sem conexão (comandas locais)

### UX/UI
- **Responsivo**: Interface adaptada para tablets (operação) e mobile (autoatendimento)
- **Tempo Real**: Atualizações automáticas do status das comandas
- **Acessibilidade**: Interface simples para diferentes perfis de usuário

## Cronograma de Desenvolvimento (2 semanas)

### Semana 1: Core e Administração
- **Dias 1-2**: Schemas, tools básicas, setup de evento
- **Dias 3-4**: CRUD de comandas, gestão de itens
- **Dias 5-7**: Dashboard administrativo, relatórios

### Semana 2: Autoatendimento e Integração
- **Dias 8-10**: Sistema de autoatendimento, autenticação por token
- **Dias 11-12**: Integração com tesouraria, workflows de fechamento
- **Dias 13-14**: Polimento, testes, documentação

## Critérios de Aceite

### MVP Funcional
- ✅ Criar e configurar evento com cardápio
- ✅ Gerenciar comandas (abrir, adicionar itens, fechar)
- ✅ Autoatendimento funcional com autenticação simples
- ✅ Dashboard com status em tempo real
- ✅ Integração automática com sistema de tesouraria
- ✅ Relatório consolidado do evento

### Qualidade
- ✅ Interface responsiva (tablet/mobile)
- ✅ Validações de negócio (preços, quantidades)
- ✅ Tratamento de erros e feedback claro
- ✅ Performance adequada para 50+ comandas simultâneas

Este sistema proporcionará uma modernização significativa na operação dos eventos do Capítulo DeMolay, mantendo a integração com o sistema financeiro existente e oferecendo uma experiência melhorada tanto para os membros quanto para os clientes.
