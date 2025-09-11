# Estratégia de Geração de PDF — Cloudflare Browser Rendering

## Contexto

Este documento complementa o `start.md` explorando uma nova abordagem para geração de PDF usando **Cloudflare Browser Rendering**, que permite renderizar HTML/CSS completo em PDF através de um browser headless serverless.

## Cloudflare Browser Rendering — Nova Opção E)

### Tecnologia
- **Cloudflare Browser Rendering** com Puppeteer/Playwright
- **HTML/CSS completo** renderizado via browser headless
- **Serverless** e integrado ao ecossistema Cloudflare Workers

### Abordagem
1. Criar templates HTML/CSS completos com papel timbrado como background
2. Renderizar o HTML no browser headless da Cloudflare
3. Gerar PDF com fidelidade total ao design visual
4. Servir tanto HTML público quanto PDF gerado

### Vantagens
- **HTML/CSS nativo**: Layout complexo, flexbox, grid, tipografia avançada
- **Fidelidade visual**: O que você vê no HTML é exatamente o PDF
- **Serverless**: Sem infraestrutura adicional, integrado ao Workers
- **Papel timbrado flexível**: PDF, PNG, SVG como background-image CSS
- **Responsivo**: Mesmo HTML serve web e PDF com media queries
- **Fonts avançadas**: Suporte a web fonts e tipografia sofisticada

### Desvantagens
- **Custo**: Cobrança por renderização (mais caro que pdf-lib)
- **Latência**: Mais lento que manipulação direta de PDF
- **Dependência**: Requer serviço externo (Browser Rendering)

## Implementação Proposta

### 1. Estrutura de Templates

```typescript
interface TemplateData {
  id: string;
  nome: string;
  tipo: "convite" | "oficio";
  letterheadId?: string;
  
  // HTML/CSS template com placeholders
  htmlTemplate: string;
  cssTemplate: string;
  
  // Configurações específicas para PDF
  pdfOptions: {
    format: "A4" | "Letter";
    margins: { top: string; bottom: string; left: string; right: string };
    printBackground: boolean;
  };
  
  // Placeholders dinâmicos
  placeholders: Array<{
    id: string;
    label: string;
    tipo: "text" | "date" | "markdown";
    required: boolean;
    default?: string;
  }>;
}
```

### 2. Template HTML Base

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: {{margins.top}} {{margins.right}} {{margins.bottom}} {{margins.left}};
    }
    
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      color: #333;
      background-image: url('{{letterheadUrl}}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
      min-height: 100vh;
      padding-top: {{contentOffset}};
    }
    
    .document-content {
      max-width: 100%;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .body-content {
      text-align: justify;
      margin-bottom: 2rem;
    }
    
    .signature-area {
      margin-top: 3rem;
      text-align: center;
    }
    
    /* Media query para visualização web */
    @media screen {
      body {
        max-width: 21cm;
        margin: 2rem auto;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
        background-color: white;
      }
    }
  </style>
</head>
<body>
  <div class="document-content">
    <div class="header">
      <h1>{{titulo}}</h1>
      {{#if subtitulo}}
      <h2>{{subtitulo}}</h2>
      {{/if}}
    </div>
    
    <div class="body-content">
      {{{bodyHtml}}}
    </div>
    
    <div class="signature-area">
      {{#if assinatura}}
      <p>{{assinatura}}</p>
      {{/if}}
      
      {{#if cargo}}
      <p><strong>{{cargo}}</strong></p>
      {{/if}}
      
      {{#if capitulo}}
      <p>{{capitulo}}</p>
      {{/if}}
    </div>
  </div>
</body>
</html>
```

### 3. Tool de Geração de PDF

```typescript
import puppeteer from "@cloudflare/puppeteer";

const createGeneratePDFTool = (env: Env) =>
  createTool({
    id: "GENERATE_DOCUMENT_PDF",
    description: "Gera PDF de documento usando Cloudflare Browser Rendering",
    inputSchema: z.object({
      documentId: z.string(),
      templateId: z.string(),
      placeholderValues: z.record(z.any()),
      letterheadUrl: z.string().optional(),
    }),
    outputSchema: z.object({
      pdfUrl: z.string(),
      htmlPreviewUrl: z.string(),
      success: z.boolean(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      
      // 1. Buscar template e dados
      const template = await db.select()
        .from(templatesTable)
        .where(eq(templatesTable.id, context.templateId))
        .limit(1);
      
      if (template.length === 0) {
        throw new Error("Template não encontrado");
      }
      
      // 2. Renderizar HTML com placeholders
      const renderedHtml = renderTemplate(
        template[0].htmlTemplate,
        {
          ...context.placeholderValues,
          letterheadUrl: context.letterheadUrl || '',
        }
      );
      
      // 3. Inicializar browser
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      
      try {
        // 4. Carregar HTML renderizado
        await page.setContent(renderedHtml, {
          waitUntil: 'networkidle0',
        });
        
        // 5. Gerar PDF
        const pdfBuffer = await page.pdf({
          format: template[0].pdfOptions.format || 'A4',
          printBackground: true,
          margin: template[0].pdfOptions.margins || {
            top: '2cm',
            bottom: '2cm',
            left: '2cm',
            right: '2cm',
          },
        });
        
        // 6. Salvar PDF no R2/storage
        const pdfKey = `pdfs/${context.documentId}.pdf`;
        await env.R2_BUCKET.put(pdfKey, pdfBuffer, {
          httpMetadata: {
            contentType: 'application/pdf',
          },
        });
        
        // 7. Salvar HTML preview
        const htmlKey = `previews/${context.documentId}.html`;
        await env.R2_BUCKET.put(htmlKey, renderedHtml, {
          httpMetadata: {
            contentType: 'text/html; charset=utf-8',
          },
        });
        
        // 8. Atualizar documento no banco
        await db.update(documentosTable)
          .set({
            pdfUrl: `${env.PUBLIC_URL}/${pdfKey}`,
            htmlPreviewUrl: `${env.PUBLIC_URL}/${htmlKey}`,
            updatedAt: new Date(),
          })
          .where(eq(documentosTable.id, context.documentId));
        
        return {
          pdfUrl: `${env.PUBLIC_URL}/${pdfKey}`,
          htmlPreviewUrl: `${env.PUBLIC_URL}/${htmlKey}`,
          success: true,
        };
        
      } finally {
        await browser.close();
      }
    },
  });
```

### 4. Configuração no wrangler.toml

```toml
# Adicionar ao wrangler.toml existente
[[deco.bindings]]
name = "BROWSER"
type = "browser"

# R2 bucket para armazenar PDFs e previews
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "demolay-documents"
```

## Fluxo de Trabalho Completo

### 1. Criação de Template
```
Admin → Cria template HTML/CSS → Define placeholders → Salva no banco
```

### 2. Instanciação de Documento
```
Usuário → Seleciona template → Preenche placeholders → Preview HTML → Salva documento
```

### 3. Geração de PDF
```
Sistema → Renderiza HTML → Browser Rendering → PDF → Armazena no R2 → URL pública
```

### 4. Distribuição
```
HTML público: /convites/:slug (responsivo, SEO-friendly)
PDF download: /convites/:slug.pdf (para impressão/anexo)
```

## Comparação com Abordagens Anteriores

| Aspecto | pdf-lib | @react-pdf | Browser Rendering |
|---------|---------|------------|-------------------|
| **Fidelidade Visual** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Velocidade** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Custo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Flexibilidade Layout** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Manutenibilidade** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Papel Timbrado PDF** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Responsividade** | ❌ | ❌ | ⭐⭐⭐⭐⭐ |

## Estratégia Híbrida Recomendada

### Fase 1 - MVP (pdf-lib)
- Usar `pdf-lib` para rapidez e baixo custo
- Templates simples com texto sobre papel timbrado
- Foco na funcionalidade core

### Fase 2 - Upgrade (Browser Rendering)
- Migrar para Browser Rendering quando precisar de:
  - Layouts mais complexos
  - Melhor tipografia
  - Templates responsivos
  - Fidelidade visual absoluta

### Implementação Gradual
```typescript
// Tool que escolhe estratégia baseado no template
const createAdaptivePDFTool = (env: Env) =>
  createTool({
    id: "GENERATE_ADAPTIVE_PDF",
    execute: async ({ context }) => {
      const template = await getTemplate(context.templateId);
      
      if (template.renderingEngine === 'browser') {
        return await generateWithBrowser(context, env);
      } else {
        return await generateWithPdfLib(context, env);
      }
    },
  });
```

## Custos Estimados

### Browser Rendering (Cloudflare)
- **Custo por renderização**: ~$0.001 USD
- **Para 1000 documentos/mês**: ~$1 USD
- **Escalável** conforme uso

### Comparação
- **pdf-lib**: Custo apenas de compute (Workers)
- **Browser Rendering**: Custo adicional por renderização
- **ROI**: Vale a pena para documentos com alta exigência visual

## Próximos Passos

1. **Implementar MVP com pdf-lib** (conforme start.md)
2. **Criar templates HTML/CSS paralelos** para teste
3. **Configurar Browser Rendering** no ambiente de desenvolvimento
4. **A/B testing** entre abordagens
5. **Migração gradual** baseada em feedback

## Conclusão

O **Cloudflare Browser Rendering** oferece a melhor qualidade visual e flexibilidade para PDFs, sendo ideal para documentos oficiais do DeMolay que precisam de apresentação impecável. A estratégia híbrida permite começar simples e evoluir conforme a necessidade, mantendo custos controlados no MVP.
