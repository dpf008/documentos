import { createRoute, type RootRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusIcon, 
  SearchIcon, 
  FilterIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PaperclipIcon
} from "lucide-react";
import { useState } from "react";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { useTransactions } from "@/hooks/useTransactions";

function MovimentacoesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: "",
    type: undefined as "entrada" | "saida" | undefined,
    startDate: "",
    endDate: "",
  });

  // Dados reais do banco
  const { data: transactionsData, isLoading, error } = useTransactions({
    ...filters,
    search: searchTerm || undefined,
  });

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
          <h1 className="text-3xl font-bold">Movimentações</h1>
          <p className="text-muted-foreground">
            Registre e acompanhe todas as entradas e saídas financeiras
          </p>
        </div>
        <CreateTransactionDialog />
      </div>

      {/* Filtros e busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select 
              value={filters.type || "todos"} 
              onValueChange={(value) => setFilters({ ...filters, type: value === "todos" ? undefined : value as "entrada" | "saida" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Data início"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />

            <Input
              type="date"
              placeholder="Data fim"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de movimentações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando movimentações...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Erro ao carregar movimentações: {error.message}
            </div>
          ) : !transactionsData?.transactions || transactionsData.transactions.length === 0 ? (
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
            <>
              <div className="space-y-4">
                {transactionsData.transactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
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
                      
                      <div className="flex-1">
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.category?.name || "Sem categoria"} • {transaction.method || "N/A"} • {transaction.date}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {transaction.attachmentCount > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <PaperclipIcon className="h-4 w-4" />
                          <span className="text-sm">{transaction.attachmentCount}</span>
                        </div>
                      )}
                      
                      <Badge variant={transaction.type === "entrada" ? "default" : "destructive"}>
                        {transaction.type}
                      </Badge>
                      
                      <div className={`font-bold text-lg ${
                        transaction.type === "entrada" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "entrada" ? "+" : "-"}
                        {formatCurrency(transaction.amountCents)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {transactionsData.pagination && transactionsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {transactionsData.pagination.page} de {transactionsData.pagination.totalPages} 
                    ({transactionsData.pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={transactionsData.pagination.page <= 1}
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={transactionsData.pagination.page >= transactionsData.pagination.totalPages}
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/movimentacoes",
    component: MovimentacoesPage,
    getParentRoute: () => parentRoute,
  });
