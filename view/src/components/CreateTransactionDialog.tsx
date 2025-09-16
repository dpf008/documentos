import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { PlusIcon } from "lucide-react";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

interface CreateTransactionDialogProps {
  trigger?: React.ReactNode;
}

export function CreateTransactionDialog({ trigger }: CreateTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "" as "entrada" | "saida" | "",
    amount: "",
    date: new Date().toISOString().split('T')[0], // Hoje
    description: "",
    categoryId: "",
    method: "",
    reference: "",
    notes: "",
  });

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Foco automático no campo de valor quando o dialog abre
  useEffect(() => {
    if (open && amountInputRef.current) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const createTransaction = useCreateTransaction();
  const { data: categoriesData } = useCategories(); // Buscar TODAS as categorias

  const resetForm = () => {
    setFormData({
      type: "",
      amount: "",
      date: new Date().toISOString().split('T')[0],
      description: "",
      categoryId: "",
      method: "",
      reference: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!formData.type || !formData.amount || !formData.description || !formData.categoryId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const amountCents = parseCurrencyValue(formData.amount);
    if (amountCents <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    try {
      await createTransaction.mutateAsync({
        type: formData.type as "entrada" | "saida",
        amountCents,
        date: formData.date,
        description: formData.description,
        categoryId: parseInt(formData.categoryId),
        method: formData.method || undefined,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      });

      // Limpar formulário e fechar dialog
      resetForm();
      setOpen(false);
    } catch (error) {
      // Erro já tratado no hook
      console.error("Erro ao criar transação:", error);
    }
  };

  const formatCurrencyInput = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Se está vazio, retorna vazio
    if (!numbers) return '';
    
    // Converte para número em centavos
    const cents = parseInt(numbers);
    
    // Formata como moeda brasileira
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    return formatted;
  };

  const parseCurrencyValue = (formattedValue: string): number => {
    // Remove formatação e converte para centavos
    const numbers = formattedValue.replace(/\D/g, '');
    return numbers ? parseInt(numbers) : 0;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Nova Movimentação
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value as "entrada" | "saida", categoryId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  ref={amountInputRef}
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatCurrencyInput(e.target.value) })}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite apenas números. Ex: 12050 vira R$ 120,50
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select 
                value={formData.categoryId} 
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                disabled={!formData.type}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.type ? "Selecione o tipo primeiro" : "Selecione a categoria"} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesData?.categories
                    ?.filter((category: { kind: string }) => category.kind === formData.type)
                    ?.map((category: { id: number; name: string }) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              placeholder="Descreva a movimentação..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              maxLength={255}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="method">Método de Pagamento</Label>
              <Select 
                value={formData.method} 
                onValueChange={(value) => setFormData({ ...formData, method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Responsável/Referência</Label>
              <Input
                id="reference"
                placeholder="Nome ou referência..."
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Salvando..." : "Salvar Movimentação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
