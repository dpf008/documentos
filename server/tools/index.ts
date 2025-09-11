/**
 * Central export point for all tools organized by domain.
 *
 * Sistema DeMolay - Gestão de Documentos e Convites
 * Domínios implementados:
 * - letterheads: Papel timbrado (PDFs, PNGs, SVGs)
 * - templates: Modelos de documentos com placeholders
 * - documents: Convites/ofícios instanciados
 * - recipients: Destinatários de documentos
 * - lists: Listas de destinatários
 * - todos/users: Legacy (manter por enquanto)
 */
import { todoTools } from "./todos.ts";
import { userTools } from "./user.ts";
import { letterheadTools } from "./letterheads.ts";
import { templateTools } from "./templates.ts";
import { documentTools } from "./documents.ts";
import { recipientTools } from "./recipients.ts";
import { listTools } from "./lists.ts";

// Export all tools from all domains
export const tools = [
  // Sistema DeMolay
  ...letterheadTools,
  ...templateTools,
  ...documentTools,
  ...recipientTools,
  ...listTools,
  
  // Legacy tools
  ...todoTools,
  ...userTools,
];

// Re-export domain-specific tools for direct access if needed
export { letterheadTools } from "./letterheads.ts";
export { templateTools } from "./templates.ts";
export { documentTools } from "./documents.ts";
export { recipientTools } from "./recipients.ts";
export { listTools } from "./lists.ts";

// Legacy exports
export { todoTools } from "./todos.ts";
export { userTools } from "./user.ts";
