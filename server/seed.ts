/**
 * Dados iniciais para o sistema de tesouraria.
 * 
 * Este arquivo contém dados de exemplo/iniciais que devem ser inseridos
 * na primeira execução do sistema.
 */
import { getDb } from "./db.ts";
import { categoriesTable, accountsTable } from "./schema.ts";
import type { Env } from "./deco.gen.ts";

export async function seedDatabase(env: Env) {
  const db = await getDb(env);
  
  try {
    // Verificar se já existe dados para evitar duplicação
    const existingAccounts = await db.select().from(accountsTable).limit(1);
    if (existingAccounts.length > 0) {
      console.log("✅ Dados já existem, pulando seed");
      return;
    }

    // Inserir conta padrão (caixa)
    await db.insert(accountsTable).values({
      id: 1,
      name: "Caixa Geral",
      initialBalanceCents: 0,
      active: 1,
      createdAt: new Date(),
    });
    
    // Inserir categorias básicas de entrada
    const entradaCategories = [
      { name: "Arrecadação de Fundos", kind: "entrada" as const },
      { name: "Doações", kind: "entrada" as const },
      { name: "Mensalidades", kind: "entrada" as const },
      { name: "Eventos", kind: "entrada" as const },
      { name: "Rifas/Sorteios", kind: "entrada" as const },
    ];
    
    // Inserir categorias básicas de saída
    const saidaCategories = [
      { name: "Filantropia", kind: "saida" as const },
      { name: "Material de Escritório", kind: "saida" as const },
      { name: "Eventos/Festividades", kind: "saida" as const },
      { name: "Transporte", kind: "saida" as const },
      { name: "Alimentação", kind: "saida" as const },
      { name: "Uniformes/Paramentos", kind: "saida" as const },
      { name: "Manutenção", kind: "saida" as const },
    ];
    
    // Inserir todas as categorias
    for (const category of [...entradaCategories, ...saidaCategories]) {
      await db.insert(categoriesTable).values({
        name: category.name,
        kind: category.kind,
        active: 1,
        createdAt: new Date(),
      });
    }
    
    console.log("✅ Dados iniciais inseridos com sucesso");
  } catch (error) {
    console.error("❌ Erro ao inserir dados iniciais:", error);
    throw error;
  }
}
