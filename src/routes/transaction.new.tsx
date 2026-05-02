import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { addMonthsISO } from "@/lib/format";
import { TransactionForm, type TransactionFormValue } from "@/components/TransactionForm";
import { playSuccess, unlockAudio } from "@/lib/sounds";

export const Route = createFileRoute("/transaction/new")({
  component: NewTransactionPage,
});

function NewTransactionPage() {
  const { activeProfile, family, refresh, loading } = useApp();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !activeProfile) navigate({ to: "/auth" });
  }, [loading, activeProfile, navigate]);

  const handleSubmit = async (values: TransactionFormValue[]) => {
    if (!activeProfile || !family || !session) return;
    unlockAudio();
    setBusy(true);
    try {
      const authUserId = session.user.id;
      const main = values[0];
      const extras = values.slice(1);

      // Insert da principal (com possível recorrência)
      const { data: parent, error: parentErr } = await supabase
        .from("transactions")
        .insert({
          family_id: family.id,
          profile_id: main.owner_profile_id,
          created_by_id: activeProfile.id,
          user_id: authUserId,
          type: main.type,
          description: main.description,
          amount: main.amount,
          date: main.date,
          category_id: main.category_id,
          payment_method_id: main.payment_method_id,
          account_id: main.account_id,
          is_paid: main.is_paid,
          is_benefit: main.is_benefit,
          recurrence_months: main.recurrence_months,
          recurrence_index: 1,
          recurrence_parent_id: null,
          paid_date: main.paid_date,
        })
        .select("id")
        .single();
      if (parentErr || !parent) throw parentErr ?? new Error("erro ao criar");

      // Parcelas restantes da recorrência
      if (main.recurrence_months > 1) {
        const rest = Array.from({ length: main.recurrence_months - 1 }, (_, i) => ({
          family_id: family.id,
          profile_id: main.owner_profile_id,
          created_by_id: activeProfile.id,
          user_id: authUserId,
          type: main.type,
          description: main.description,
          amount: main.amount,
          date: addMonthsISO(main.date, i + 1),
          category_id: main.category_id,
          payment_method_id: main.payment_method_id,
          is_paid: false,
          is_benefit: main.is_benefit,
          recurrence_months: main.recurrence_months,
          recurrence_index: i + 2,
          recurrence_parent_id: parent.id,
          paid_date: null,
        }));
        const { error } = await supabase.from("transactions").insert(rest);
        if (error) toast.error("Parcelas: " + error.message);
      }

      // Extras do lote — bulk insert atômico
      if (extras.length > 0) {
        const rows = extras.map((v) => ({
          family_id: family.id,
          profile_id: v.owner_profile_id,
          created_by_id: activeProfile.id,
          user_id: authUserId,
          type: v.type,
          description: v.description,
          amount: v.amount,
          date: v.date,
          category_id: v.category_id,
          payment_method_id: v.payment_method_id,
          is_paid: v.is_paid,
          is_benefit: v.is_benefit,
          recurrence_months: 1,
          recurrence_index: 1,
          recurrence_parent_id: null,
          paid_date: v.paid_date,
        }));
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) throw error;
      }

      await refresh();
      try { playSuccess(); } catch { /* noop */ }
      const total = values.length;
      toast.success(
        total === 1
          ? "Transação adicionada!"
          : `${total} transações adicionadas com sucesso!`,
      );
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

      <div className="mx-auto max-w-2xl px-4 pt-5">
        <TransactionForm
          busy={busy}
          submitLabel="Adicionar"
          allowBulk
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/dashboard" })}
        />
      </div>
    </div>
  );
}
