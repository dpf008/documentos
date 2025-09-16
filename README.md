# Sistema de Tesouraria — Capítulo DeMolay

Sistema de gestão financeira para Capítulos DeMolay, permitindo registro de movimentações (entradas/saídas), anexos de comprovantes, relatórios exportáveis e dashboards com gráficos e análises. Construído sobre [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) com frontend React moderno.

O servidor MCP expõe ferramentas e workflows para gestão financeira e também serve a interface web em React + Tailwind CSS.

## 📄 Plano de implementação

Veja `plans/tesouraria/README.md` para o plano completo de implementação, incluindo schema de banco, tools, views e cronograma detalhado.

## 📝 Development History

This repository uses [Specstory](https://specstory.com/) to track the history of
prompts that were used to code this repo. You can inspect the complete
development history in the [`.specstory/`](.specstory/) folder.

## ✨ Funcionalidades (MVP)

- **🤖 MCP Server**: Cloudflare Workers com ferramentas/workflows tipados
- **⚛️ React Frontend**: Vite, TanStack Router e Tailwind CSS
- **💰 Gestão Financeira**: Registro de entradas/saídas com categorização
- **📎 Anexos**: Upload seguro de comprovantes via Cloudflare R2
- **📊 Relatórios**: Exportação em CSV/PDF com totais e agrupamentos
- **📈 Dashboard**: Gráficos interativos com análise de tendências
- **🔐 Autenticação**: Integração com sistema Deco (createPrivateTool)
- **📋 Auditoria**: Log completo de todas as operações
- **🚀 Hot Reload**: Live reload para frontend e backend
- **☁️ Deploy**: Cloudflare Workers

## 🚀 Quick Start

### Prerequisites

- Node.js ≥22.0.0
- [Deco CLI](https://deco.chat): `npm i -g deco-cli`

### Setup

```bash
# Install dependencies
npm install

# Configure your app
npm run configure

# Start development server
npm run dev
```

O servidor iniciará em `http://localhost:8787` servindo a API MCP e o frontend.

## 📁 Estrutura do Projeto

```
├── server/           # MCP Server (Cloudflare Workers + Deco runtime)
│   ├── main.ts      # Server entry point with tools & workflows
│   └── deco.gen.ts  # Auto-generated integration types
└── view/            # React Frontend (Vite + Tailwind CSS)
    ├── src/
    │   ├── lib/rpc.ts    # Typed RPC client for server communication
    │   ├── routes/       # TanStack Router routes
    │   └── components/   # UI components with Tailwind CSS
    └── package.json
```

## 🛠️ Workflow de Desenvolvimento

- **`npm run dev`** - Start development with hot reload
- **`npm run gen`** - Generate types for external integrations
- **`npm run gen:self`** - Generate types for your own tools/workflows
- **`npm run deploy`** - Deploy to production

## 🔗 Comunicação Frontend ↔ Server

The template includes a fully-typed RPC client that connects your React frontend
to your MCP server:

```typescript
// Typed calls to your server tools and workflows
const result = await client.MY_TOOL({ input: "data" });
const workflowResult = await client.MY_WORKFLOW({ input: "data" });
```

## 📖 Learn More

Baseado na plataforma [Deco](https://deco.chat/about).
Docs: [https://docs.deco.page](https://docs.deco.page)

---

**Objetivo:** facilitar a gestão financeira do Capítulo DeMolay com controle de movimentações, relatórios auditáveis e dashboards para tomada de decisão.
