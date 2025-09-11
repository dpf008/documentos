## Plano inicial — Sistema Operacional do Capítulo DeMolay

### Objetivo
Construir um sistema operacional focado na diretoria do Capítulo DeMolay (Mestre Conselheiro, 1º/2º Conselheiros, Escrivão, Tesoureiro) iniciando por gestão de documentos e templates para geração de ofícios e convites, com papel timbrado, IA para criação em massa e envio por e-mail. Cada convite/ofício gerado deve existir como entidade própria com URL pública em HTML (não apenas PDF).

### Escopo Fase 1 (MVP)
- **Upload e gestão de papel timbrado** (preferência: PDF; alternativas: PNG/SVG).  
- **Templates** (convites, ofícios): variáveis, corpo padrão (Markdown/Texto enriquecido), estilos básicos (margens, tipografia, cabeçalho/rodapé).  
- **Instanciação de documentos**: criar "Convite" a partir de template + variáveis; preview HTML; geração de PDF.  
- **Lista de destinatários**: cadastro/importação; disparo por e-mail com personalização.  
- **Link público**: página HTML responsiva para cada convite/ofício.  
- **IA nativa**: assistentes para redigir/variar textos e preencher placeholders.

---

## Modelagem de Domínio (inicial)

- **Letterhead (PapelTimbrado)**
  - id, nome, arquivo (PDF/PNG/SVG), páginas (se PDF multi-página), ativo, createdAt
- **Template**
  - id, tipo: "convite" | "oficio" | ..., nome, descrição
  - letterheadId (opcional)
  - placeholders: [{ id, label, tipo, required, default }]
  - layout: { margens, fonte, tamanhos, alinhamentos }
  - body: Markdown ou RichText (armazenado como Markdown)
  - versão, createdAt, updatedAt
- **Convite (ou DocumentoInstanciado)**
  - id, templateId, letterheadOverrideId (opcional)
  - titulo, bodyRenderizado (HTML), bodyFonte (Markdown), placeholdersPreenchidos (JSON)
  - pdfUrl (opcional, se já gerado e armazenado), publicSlug, isPublic, createdBy, createdAt
- **Destinatário**
  - id, nome, email, tags
- **Lista**
  - id, nome; relacionamento N:N (lista <-> destinatários)
- **EnvioEmail**
  - id, conviteId, destinatarioId, status, messageId, sentAt, error

Armazenamento de binários: bucket (R2) ou KV/FS via plataforma; metadados no banco (Drizzle/SQLite DO).

---

## Geração de PDF — Alternativas

### A) Sobreposição em PDF existente (recomendado)
Tecnologias: `pdf-lib` (JS puro, compatível com Cloudflare Workers).  
Abordagem: importar o PDF do papel timbrado como background (embed de página) e desenhar texto/imagens por cima com coordenadas e quebras de linha controladas.

Prós:
- Usa diretamente o PDF timbrado enviado (sem conversões).  
- Determinístico, rápido, sem headless browser.  
- Compatível com Workers/serverless.  

Contras:
- Layout é programático; não renderiza HTML/CSS nativamente (teremos que medir larguras/usar `maxWidth` para wrap).  

Quando usar: quando o timbrado oficial é PDF e a fidelidade deve ser alta e estável em ambiente serverless.

### B) Templates declarativos em React -> PDF
Tecnologias: `@react-pdf/renderer`.  
Abordagem: criar componentes React que geram o PDF. O papel timbrado vira imagem de fundo (PNG/SVG) posicionada.

Prós:
- DX excelente, layout declarativo, fácil componentes reutilizáveis.  

Contras:
- Não importa PDF diretamente como background (precisa converter a primeira página para imagem).  
- Fidelidade ao timbrado PDF depende da conversão e resolução.  

Quando usar: quando preferimos DX declarativa e aceitamos timbrado como imagem.

### C) HTML -> Canvas -> PDF (client-side)
Tecnologias: `html2canvas` + `jsPDF`.  
Abordagem: renderizar HTML no cliente, capturar como imagem e gerar PDF.

Prós:
- Simples para protótipo; preview é idêntico ao que o usuário vê.  

Contras:
- Qualidade variável, fontes e quebras podem ficar imprecisas; acessibilidade e seleção de texto ruins (vira imagem).  
- Difícil padronizar em produção.

Quando usar: protótipos e casos sem alta exigência tipográfica.

### D) PDF com campos (AcroForms) + preenchimento
Tecnologias: `pdf-lib` para preencher e "flatten".  
Abordagem: timbrado com campos editáveis definidos previamente; o sistema só preenche.

Prós:
- Precisão absoluta; menos lógica de layout no código.  

Contras:
- Requer criação/curadoria dos PDFs com campos. Menos flexível para mudanças estruturais.

Quando usar: ofícios muito padronizados mantidos por longos períodos.

---

## Recomendação técnica para o MVP
1) Guardar o timbrado como PDF.  
2) Renderizar PDF via `pdf-lib` sobrepondo texto/imagens com estilos simples (fonte, tamanho, bold, alinhamento, margens).  
3) Representar o corpo do template em Markdown para edição amigável; na renderização para PDF, converter para linhas quebradas respeitando margens (sem HTML completo no PDF).  
4) A visualização pública será em HTML (renderização do Markdown -> HTML), garantindo melhor SEO e experiência. O PDF é um anexo derivado.  
5) Armazenar o PDF gerado no bucket (R2/FS) e manter URL no registro do convite.

Observação: se futuramente precisarmos de HTML/CSS completo no PDF, podemos adicionar um serviço de renderização com browser headless (Cloudflare Browser Rendering) como plano B, sem mudar o domínio de dados.

---

## Fluxos principais

1) Upload do timbrado
   - Admin sobe PDF -> valida páginas -> salva metadados e arquivo.  

2) CRUD de templates
   - Define placeholders (ex.: `evento`, `data`, `local`).  
   - Define corpo (Markdown) + parâmetros de layout.  

3) Criação de convite/ofício
   - Seleciona template -> preenche placeholders (manual ou com IA) -> preview HTML -> salva entidade.  
   - Gera PDF on-demand (ou sob demanda na ação de envio/baixar).  

4) Envio por e-mail
   - Seleciona destinatários/listas -> IA pode gerar variantes (assunto/abertura) -> envia e registra logs.  

5) Link público
   - Rota `/convites/:id/:slug` (HTML) com `isPublic` e `publicSlug`.  
   - Pode expor link do PDF também (`/convites/:id.pdf`).

---

## IA nativa (padrão de uso)

- Ferramenta de geração estruturada para preencher placeholders e redigir corpo: usar `AI_GENERATE_OBJECT` com schema dinâmico conforme placeholders do template.  
- Ações sugeridas: "Gerar versão formal", "Gerar versão jovem", "Encurtar", "Adaptar para WhatsApp".  
- Para listas: mesclar placeholders por destinatário (ex.: nome) e gerar corpo personalizado em lote.

---

## Interfaces e UX (MVP)

- Tela "Papel Timbrado": listagem, upload, pré-visualização (miniatura 1ª página).  
- Tela "Templates": CRUD, editor Markdown com preview, gestão de placeholders.  
- Tela "Convites/Ofícios": formulário a partir do template, preview HTML, ação "Gerar PDF", toggle "Público".  
- Tela "Destinatários" e "Listas": importação CSV, tags, contagem.  
- Tela "Envios": seleção de convite + listas, confirmação, logs.  

---

## Padrões técnicos

- Backend: Cloudflare Workers + Deco runtime; DB (Drizzle/SQLite DO).  
- Arquivos: R2/FS (URL assinada para download).  
- PDF: `pdf-lib`.  
- Frontend: React + Tailwind; editor Markdown; visualização pública HTML.  
- E-mail: integração (Resend/SMTP/CF Email), fila simples (workflow) e retry.  
- Permissões: papéis (MC, 1º/2º C, Escrivão, Tesoureiro) com escopo para CRUD e envios.  

---

## Roadmap (alto nível)

1. MVP documentos (timbrado, templates, convites/ofícios, PDF + link público, destinatários, envio básico).  
2. Assinaturas e numeração de ofícios; protocolo.  
3. Modelos adicionais (atas, relatórios, recibos).  
4. Integrações (agenda/calendário, pagamentos para eventos).  
5. Analytics de aberturas/cliques; gestão de campanhas.  
6. Ferramentas IA avançadas (tons de voz, traduções, normalizador de linguagem ritualística quando cabível).


