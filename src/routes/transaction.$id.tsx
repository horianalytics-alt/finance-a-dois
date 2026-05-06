import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { TransactionForm, type TransactionFormValue } from "@/components/TransactionForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/transaction/$id")({
  component: EditTransactionPage,
});

function EditTransactionPage() {
  const { id } = useParams({ from: "/transaction/$id" });
  const { transactions, refresh, loading, activeProfile } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [applyToSeries, setApplyToSeries] = useState(true);

  const tx = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);

  useEffect(() => {
    if (!loading && !activeProfile) navigate({ to: "/auth" });
  }, [loading, activeProfile, navigate]);

  if (!tx) {
    return (
      <div className="min-h-svh bg-background p-5">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </Link>
        <p className="mt-10 text-center text-muted-foreground">Transação não encontrada.</p>
      </div>
    );
  }

  const isRecurring = tx.recurrence_months > 1;
  const seriesParentId = tx.recurrence_parent_id ?? tx.id;

  const handleSubmit = async (values: TransactionFormValue[]) => {
    const v = values[0];
    setBusy(true);
    try {
      const patch = {
        type: v.type,
        description: v.description,
        amount: v.amount,
        date: v.date,
        category_id: v.category_id,
        payment_method_id: v.payment_method_id,
        account_id: v.account_id,
        is_paid: v.is_paid,
        is_benefit: v.is_benefit,
        owner: v.owner,
        is_futile: v.is_futile,
        futile_label: v.futile_label,
        paid_date: v.paid_date,
        profile_id: v.owner_profile_id,
      };

      if (isRecurring && applyToSeries) {
        const seriesPatch = {
          type: v.type,
          description: v.description,
          category_id: v.category_id,
          payment_method_id: v.payment_method_id,
          account_id: v.account_id,
          is_benefit: v.is_benefit,
          profile_id: v.owner_profile_id,
        };
        // 1) atualiza esta exata (com tudo)
        const { error: e1 } = await supabase.from("transactions").update(patch).eq("id", tx.id);
        if (e1) throw e1;
        // 2) atualiza as outras da série com seriesPatch
        const { error: e2 } = await supabase
          .from("transactions")
          .update(seriesPatch)
          .or(`id.eq.${seriesParentId},recurrence_parent_id.eq.${seriesParentId}`)
          .neq("id", tx.id);
        if (e2) throw e2;
        toast.success("Série atualizada");
      } else {
        const { error } = await supabase.from("transactions").update(patch).eq("id", tx.id);
        if (error) throw error;
        toast.success("Transação atualizada");
      }

      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (mode: "single" | "series") => {
    setBusy(true);
    try {
      if (mode === "series" && isRecurring) {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .or(`id.eq.${seriesParentId},recurrence_parent_id.eq.${seriesParentId}`);
        if (error) throw error;
        toast.success("Série excluída");
      } else {
        const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
        if (error) throw error;
        toast.success("Transação excluída");
      }
      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Editar transação</h1>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Excluir">
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              {isRecurring && (
                <AlertDialogAction
                  onClick={() => handleDelete("series")}
                  className="bg-destructive text-destructive-foreground"
                >
                  Excluir série inteira
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={() => handleDelete("single")}
                className="bg-destructive text-destructive-foreground"
              >
                Excluir só esta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <div className="space-y-4 px-4 pt-5">
        {isRecurring && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs">
            <input
              id="apply-series"
              type="checkbox"
              checked={applyToSeries}
              onChange={(e) => setApplyToSeries(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--primary)]"
            />
            <label htmlFor="apply-series" className="flex-1">
              Aplicar mudanças (descrição, categoria, forma, etc.) à série toda
              ({tx.recurrence_index}/{tx.recurrence_months})
            </label>
          </div>
        )}

        <TransactionForm
          initial={tx}
          busy={busy}
          submitLabel="Salvar alterações"
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/dashboard" })}
          hideRecurrence
        />
      </div>
    </div>
  );
}
