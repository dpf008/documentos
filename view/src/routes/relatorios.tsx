import { createRoute, type RootRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DownloadIcon, 
  FileTextIcon,
  FileSpreadsheetIcon,
  CalendarIcon,
  TrendingUpIcon
} from "lucide-react";
import { useState } from "react";

function RelatoriosPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [groupBy, setGroupBy] = useState("month");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios financeiros detalhados para análise e prestação de contas
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuração do relatório */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Configurar Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Data de Início</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end-date">Data de Fim</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Agrupar Por</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1">
                <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                Gerar CSV
              </Button>
              <Button variant="outline" className="flex-1">
                <FileTextIcon className="mr-2 h-4 w-4" />
                Gerar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prévia do relatório */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5" />
              Prévia do Relatório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">R$ 0,00</div>
                  <div className="text-sm text-green-600">Total de Entradas</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">R$ 0,00</div>
                  <div className="text-sm text-red-600">Total de Saídas</div>
                </div>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">R$ 0,00</div>
                <div className="text-sm text-blue-600">Saldo do Período</div>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                Selecione um período para visualizar os dados
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relatórios salvos */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Gerados Recentemente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum relatório gerado ainda.
            <br />
            <span className="text-sm">Configure as opções acima e gere seu primeiro relatório.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/relatorios",
    component: RelatoriosPage,
    getParentRoute: () => parentRoute,
  });
