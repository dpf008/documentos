import { createRoute, type RootRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUpIcon, DollarSignIcon, PieChartIcon } from "lucide-react";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { SeedCategoriesButton } from "@/components/SeedCategoriesButton";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardMetrics } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

function DashboardPage() {
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const hasCategories = categoriesData?.categories && categoriesData.categories.length > 0;
  
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useDashboardMetrics();
  
  // Debug temporário
  console.log("Dashboard metrics data:", metricsData);
  console.log("Dashboard metrics loading:", metricsLoading);
  console.log("Dashboard metrics error:", metricsError);
  
  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amountCents / 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Tesouraria</h1>
          <p className="text-muted-foreground">
            Visão geral das movimentações financeiras do capítulo
          </p>
        </div>
        {hasCategories && <CreateTransactionDialog />}
      </div>

      {/* Mostrar botão de seed se não há categorias */}
      {!categoriesLoading && !hasCategories && (
        <div className="max-w-md mx-auto">
          <SeedCategoriesButton />
        </div>
      )}

      {/* Cards de resumo com dados reais */}
      {hasCategories && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metricsLoading ? "..." : formatCurrency(metricsData?.summary.totalEntradas || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {metricsData?.summary.percentualVariacao !== undefined 
                  ? `${metricsData.summary.percentualVariacao > 0 ? '+' : ''}${metricsData.summary.percentualVariacao}% em relação ao mês anterior`
                  : "Este período"
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-red-600 rotate-180" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {metricsLoading ? "..." : formatCurrency(metricsData?.summary.totalSaidas || 0)}
              </div>
              <p className="text-xs text-muted-foreground">Este período</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (metricsData?.summary.saldoAtual || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {metricsLoading ? "..." : formatCurrency(metricsData?.summary.saldoAtual || 0)}
              </div>
              <p className="text-xs text-muted-foreground">Caixa geral</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Movimentações</CardTitle>
              <PieChartIcon className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metricsLoading ? "..." : metricsData?.summary.movimentacoesCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Este período</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos e tabelas com dados reais */}
      {hasCategories && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fluxo Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Carregando dados...
                  </div>
                ) : metricsData?.monthlyFlow.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metricsData?.monthlyFlow.slice(0, 6).map((month: any) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <div className="text-sm font-medium">{month.month}</div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-green-600">
                            +{formatCurrency(month.entradas)}
                          </div>
                          <div className="text-sm text-red-600">
                            -{formatCurrency(month.saidas)}
                          </div>
                          <div className={`text-sm font-bold ${
                            month.saldo >= 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {formatCurrency(Math.abs(month.saldo))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Carregando dados...
                  </div>
                ) : metricsData?.categoryDistribution.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhuma movimentação para mostrar
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metricsData?.categoryDistribution.slice(0, 8).map((category: any) => (
                      <div key={category.categoryName} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={category.categoryKind === "entrada" ? "default" : "destructive"}>
                            {category.categoryKind}
                          </Badge>
                          <span className="text-sm">{category.categoryName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(category.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({category.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Movimentações Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando movimentações...
                </div>
              ) : !metricsData?.recentTransactions || metricsData.recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação encontrada.
                  <br />
                  <CreateTransactionDialog 
                    trigger={
                      <Button variant="link" className="mt-2">
                        Registrar primeira movimentação
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {metricsData.recentTransactions.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          transaction.type === "entrada" 
                            ? "bg-green-100 text-green-600" 
                            : "bg-red-100 text-red-600"
                        }`}>
                          {transaction.type === "entrada" ? (
                            <ArrowUpIcon className="h-4 w-4" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div>
                          <div className="font-medium text-sm">{transaction.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.categoryName} • {transaction.method || "N/A"} • {transaction.date}
                          </div>
                        </div>
                      </div>

                      <div className={`font-bold ${
                        transaction.type === "entrada" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "entrada" ? "+" : "-"}
                        {formatCurrency(transaction.amountCents)}
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center pt-4">
                    <Button variant="outline" asChild>
                      <a href="/movimentacoes">Ver todas as movimentações</a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: DashboardPage,
    getParentRoute: () => parentRoute,
  });
