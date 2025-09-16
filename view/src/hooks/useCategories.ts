import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/rpc";
import { toast } from "sonner";

export const useCategories = (kind?: "entrada" | "saida") => {
  return useQuery({
    queryKey: ["categories", kind],
    queryFn: () => client.LIST_CATEGORIES_PUBLIC({ kind }),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; kind: "entrada" | "saida" }) => 
      client.CREATE_CATEGORY(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      console.error("Erro ao criar categoria:", error);
      toast.error("Erro interno do servidor");
    },
  });
};
