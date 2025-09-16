/**
 * Central export point for all tools organized by domain.
 *
 * Sistema de Tesouraria - Capítulo DeMolay
 * Domínios implementados:
 * - tesouraria: Gestão financeira (movimentações, categorias, relatórios)
 * - todos/users: Legacy (manter por enquanto)
 */
import { todoTools } from "./todos.ts";
import { userTools } from "./user.ts";
import { tesourariaTools } from "./tesouraria.ts";

// Export all tools from all domains
export const tools = [
  // Sistema de Tesouraria
  ...tesourariaTools,
  
  // Legacy tools
  ...todoTools,
  ...userTools,
];

// Re-export domain-specific tools for direct access if needed
export { tesourariaTools } from "./tesouraria.ts";

// Legacy exports
export { todoTools } from "./todos.ts";
export { userTools } from "./user.ts";
