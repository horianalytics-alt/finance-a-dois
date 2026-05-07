import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Target, Save, Trash2 } from "lucide-react";
import { formatBRL, monthKeyFromISO, parseBRLInput, todayISO } from "@/lib/format";
import { MonthNavigator } from "@/components/MonthNavigator";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { toast } from "sonner";

export const Route = createFileRoute("/metas")({
  component: MetasPage,
});

type AccountGoalRow = {
  id: string;
  account_id: string;
  month: string;
  goal_amount: number;
};

type CategoryBudgetRow = {
  id: string;
  category_id: string;
  month: string;
  budget: number;
};

function MetasPage() {
  const { session, loading: authLoading } = useAuth();
  const {
    family, accounts, categories, transactions, hideValues, toggleHideValues,
    needsOnboarding, activeProfile, loading,
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const [activeMonth, setActiveMonth] = useState(() => monthKeyFromISO(todayISO()));
  const [accountGoals, setAccountGoals] = useState<AccountGoalRow[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!family?.id) return;
    const [agRes, cbRes] = await Promise.all([
      supabase.from("account_goals").select("id, account_id, month, goal_amount").eq("family_id", family.id).eq("month", activeMonth),
      supabase.from("category_budgets").select("id, category_id, month, budget").eq("family_id", family.id).eq("month", activeMonth),
    ]);
    if (agRes.data) setAccountGoals(agRes.data as AccountGoalRow[]);
    if (cbRes.data) setBudgets(cbRes.data as CategoryBudgetRow[]);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [family?.id, activeMonth]);

  // Realizado por conta no mês (despesas pagas)
  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );
  const realizedByAccount = useMemo(() => {
    const m = new Map<string, number>();
    monthTx.filter((t) => t.type === "despesa" && t.is_paid).forEach((t) => {
      m.set(t.account_id, (m.get(t.account_id) ?? 0) + Number(t.amount));
    });
    return m;
  }, [monthTx]);
  const realizedByCategory = useMemo(() => {
    const m = new Map<string, number>();
    monthTx.filter((t) => t.type === "despesa").forEach((t) => {
      if (!t.category_id) return;
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount));
    });
    return m;
  }, [monthTx]);

  const despesaCategories = categories.filter((c) => c.type === "despesa");

  const upsertAccountGoal = async (account_id: string, value: number) => {
    if (!family?.id) return;
    setBusy(true);
    const { error } = await supabase
      .from("account_goals")
      .upsert(
        { family_id: family.id, account_id, month: activeMonth, goal_amount: value },
        { onConflict: "account_id,month" },
      );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Meta salva");
    await reload();
  };

  const upsertBudget = async (category_id: string, value: number) => {
    if (!family?.id) return;
    setBusy(true);
    const { error } = await supabase
      .from("category_budgets")
      .upsert(
        { family_id: family.id, category_id, month: activeMonth, budget: value },
        { onConflict: "category_id,month" },
      );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento salvo");
    await reload();
  };

  const deleteAccountGoal = async (id: string) => {
    const { error } = await supabase.from("account_goals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Meta removida");
    await reload();
  };

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from("category_budgets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento removido");
    await reload();
  };

  if (authLoading || loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!activeProfile) return null;

  return (
    <>
      <DesktopSidebar hideValues={hideValues} toggleHideValues={toggleHideValues} />
      <div className="min-h-svh w-full bg-background pb-32 lg:pl-56">
        <header className="sticky top-0 z-30 w-full border-b bg-background">
          <div className="flex items-center gap-2 px-4 py-3">
            <Link to="/dashboard" className="lg:hidden">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Metas</h1>
          </div>
          <div className="border-t bg-background/60 px-4 py-2">
            <MonthNavigator monthKey={activeMonth} onChange={setActiveMonth} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pt-5">
          <Tabs defaultValue="accounts">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="accounts">Por conta</TabsTrigger>
              <TabsTrigger value="categories">Por categoria</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="space-y-3 pt-4">
              {accounts.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</CardContent></Card>
              ) : accounts.map((a) => {
                const row = accountGoals.find((g) => g.account_id === a.id);
                const realized = realizedByAccount.get(a.id) ?? 0;
                return (
                  <GoalRow
                    key={a.id}
                    label={a.name}
                    sub={a.type === "beneficio" ? "Benefício" : "Conta corrente"}
                    initialValue={row?.goal_amount ?? 0}
                    realized={realized}
                    onSave={(v) => upsertAccountGoal(a.id, v)}
                    onDelete={row ? () => deleteAccountGoal(row.id) : undefined}
                    busy={busy}
                  />
                );
              })}
            </TabsContent>

            <TabsContent value="categories" className="space-y-3 pt-4">
              {despesaCategories.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma categoria de despesa.</CardContent></Card>
              ) : despesaCategories.map((c) => {
                const row = budgets.find((b) => b.category_id === c.id);
                const realized = realizedByCategory.get(c.id) ?? 0;
                return (
                  <GoalRow
                    key={c.id}
                    label={c.name}
                    sub="Orçamento mensal"
                    initialValue={row?.budget ?? 0}
                    realized={realized}
                    onSave={(v) => upsertBudget(c.id, v)}
                    onDelete={row ? () => deleteBudget(row.id) : undefined}
                    busy={busy}
                  />
                );
              })}
            </TabsContent>
          </Tabs>
        </main>
      </div>
      <BottomTabBar />
    </>
  );
}

function GoalRow({
  label, sub, initialValue, realized, onSave, onDelete, busy,
}: {
  label: string;
  sub: string;
  initialValue: number;
  realized: number;
  onSave: (v: number) => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  const [raw, setRaw] = useState(initialValue ? String(initialValue).replace(".", ",") : "");
  useEffect(() => {
    setRaw(initialValue ? String(initialValue).replace(".", ",") : "");
  }, [initialValue]);
  const goal = initialValue;
  const pct = goal > 0 ? Math.min(100, Math.round((realized / goal) * 100)) : 0;
  const over = goal > 0 && realized > goal;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Realizado</p>
            <p className={`text-sm font-bold tabular-nums ${over ? "text-destructive" : ""}`}>{formatBRL(realized)}</p>
          </div>
        </div>

        {goal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{pct}% da meta {formatBRL(goal)}</span>
              {over && <span className="font-semibold text-destructive">Excedido</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="h-9 flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              const n = parseBRLInput(raw);
              if (!Number.isFinite(n) || n < 0) {
                toast.error("Valor inválido");
                return;
              }
              onSave(n);
            }}
            disabled={busy}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> Salvar
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} disabled={busy} aria-label="Remover">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
