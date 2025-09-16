import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/rpc";
import { toast } from "sonner";

// Tipos para os parâmetros
interface TransactionFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  type?: "entrada" | "saida";
  categoryId?: number;
  accountId?: number;
  search?: string;
}

interface CreateTransactionInput {
  type: "entrada" | "saida";
  amountCents: number;
  date: string;
  description: string;
  categoryId: number;
  accountId?: number;
  method?: string;
  reference?: string;
  notes?: string;
}

// Hook para listar transações
export const useTransactions = (filters: TransactionFilters = {}) => {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => client.GET_TRANSACTIONS(filters),
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

// Hook para criar transação
export const useCreateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionInput) => client.CREATE_TRANSACTION_SQL(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Movimentação criada com sucesso!");
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      } else {
        toast.error(result.message || "Erro ao criar movimentação");
      }
    },
    onError: (error) => {
      console.error("Erro ao criar transação:", error);
      toast.error("Erro interno do servidor");
    },
  });
};
