import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { addMonthsISO } from "@/lib/format";
import { TransactionForm, type TransactionFormValue } from "@/components/TransactionForm";

export const Route = createFileRoute("/transaction/new")({
  component: NewTransactionPage,
});

function NewTransactionPage() {
  const { activeProfile, family, refresh, loading } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !activeProfile) navigate({ to: "/auth" });
  }, [loading, activeProfile, navigate]);

  const handleSubmit = async (v: TransactionFormValue) => {
    if (!activeProfile || !family) return;
    setBusy(true);
    try {
      // 1) Mãe
      const { data: parent, error: parentErr } = await supabase
        .from("transactions")
        .insert({
          family_id: family.id,
          profile_id: v.owner_profile_id, // OWNER
          created_by_id: activeProfile.id, // AUTOR
          user_id: activeProfile.user_id,
          type: v.type,
          description: v.description,
          amount: v.amount,
          date: v.date,
          category_id: v.category_id,
          payment_method_id: v.payment_method_id,
          is_paid: v.is_paid,
          is_benefit: v.is_benefit,
          recurrence_months: v.recurrence_months,
          recurrence_index: 1,
          recurrence_parent_id: null,
          paid_date: v.paid_date,
        })
        .select("id")
        .single();
      if (parentErr || !parent) throw parentErr ?? new Error("erro ao criar");

      // 2) Parcelas restantes
      if (v.recurrence_months > 1) {
        const rest = Array.from({ length: v.recurrence_months - 1 }, (_, i) => ({
          family_id: family.id,
          profile_id: v.owner_profile_id,
          created_by_id: activeProfile.id,
          user_id: activeProfile.user_id,
          type: v.type,
          description: v.description,
          amount: v.amount,
          date: addMonthsISO(v.date, i + 1),
          category_id: v.category_id,
          payment_method_id: v.payment_method_id,
          is_paid: false,
          is_benefit: v.is_benefit,
          recurrence_months: v.recurrence_months,
          recurrence_index: i + 2,
          recurrence_parent_id: parent.id,
          paid_date: null,
        }));
        const { error } = await supabase.from("transactions").insert(rest);
        if (error) toast.error("Parcelas: " + error.message);
      }

      await refresh();
      toast.success("Transação adicionada!");
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Nova transação</h1>
      </header>

      <div className="px-4 pt-5">
        <TransactionForm
          busy={busy}
          submitLabel="Adicionar"
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/dashboard" })}
        />
      </div>
    </div>
  );
}
