import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsIcon, CheckCircleIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

export function SeedCategoriesButton() {
  const [isSeeding, setIsSeeding] = useState(false);
  const queryClient = useQueryClient();

  const seedMutation = useMutation({
    mutationFn: () => client.SEED_CATEGORIES({}),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        // Invalidar cache das categorias para recarregar
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        setIsSeeding(false);
      } else {
        toast.error(result.message);
        setIsSeeding(false);
      }
    },
    onError: (error) => {
      console.error("Erro ao popular categorias:", error);
      toast.error("Erro ao popular categorias iniciais");
      setIsSeeding(false);
    },
  });

  const handleSeed = () => {
    setIsSeeding(true);
    seedMutation.mutate();
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-muted-foreground">
          <SettingsIcon className="h-5 w-5" />
          Configuração Inicial
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Parece que é a primeira vez usando o sistema. 
          <br />
          Clique abaixo para criar as categorias iniciais.
        </p>
        
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            <strong>Categorias de Entrada:</strong> Arrecadação de Fundos, Doações, Mensalidades, Eventos, Rifas/Sorteios
          </div>
          <div className="text-xs text-muted-foreground">
            <strong>Categorias de Saída:</strong> Filantropia, Material de Escritório, Eventos, Transporte, Alimentação, Uniformes, Manutenção
          </div>
        </div>

        <Button 
          onClick={handleSeed}
          disabled={isSeeding || seedMutation.isPending}
          className="w-full"
        >
          {isSeeding || seedMutation.isPending ? (
            <>
              <CheckCircleIcon className="mr-2 h-4 w-4 animate-spin" />
              Criando categorias...
            </>
          ) : (
            <>
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Criar Categorias Iniciais
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Você poderá criar mais categorias depois conforme necessário.
        </p>
      </CardContent>
    </Card>
  );
}
