import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Eye, EyeOff, Settings, Plus, Download, TrendingUp, Sparkles, Wallet,
  ArrowDownCircle, ArrowUpCircle, Activity, PiggyBank, Calendar,
  ArrowDownToLine, ArrowUpFromLine, TrendingDown, Database, Trash2, CheckSquare, Square,
  BarChart3,
} from "lucide-react";
import {
  formatBRL, formatBRLCompact, maskedBRL, monthKeyFromISO, todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteSwitcher } from "@/components/PaletteSwitcher";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionCard } from "@/components/TransactionCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { playDelete, unlockAudio } from "@/lib/sounds";
import type { Transaction } from "@/lib/app-context";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type FilterMode = "all" | "receita" | "despesa" | "investimento" | string;
type SortMode = "recent" | "old" | "highest" | "lowest";

function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const {
    loading, activeProfile, members, categories, paymentMethods, transactions,
    hideValues, toggleHideValues, needsOnboarding, newTxIds, acknowledgeNewTx, refresh,
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const [activeMonth, setActiveMonth] = useState<string>(() => monthKeyFromISO(todayISO()));

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );

  // ===== 8 CARDS — somas em precisão decimal (Number sobre numeric do PG) =====
  const sumBy = (
    list: Transaction[],
    type: Transaction["type"],
    isBenefit?: boolean,
    paid?: boolean,
  ) =>
    list
      .filter((t) => t.type === type)
      .filter((t) => (isBenefit === undefined ? true : t.is_benefit === isBenefit))
      .filter((t) => (paid === undefined ? true : t.is_paid === paid))
      .reduce((s, t) => s + Number(t.amount), 0);

  const allPaid = transactions.filter((t) => t.is_paid);
  const totalReceitasPagas = sumBy(allPaid, "receita");
  const totalDespesasPagas = sumBy(allPaid, "despesa");
  const totalInvestPagas = sumBy(allPaid, "investimento");

  const benefitBalance =
    sumBy(allPaid, "receita", true) - sumBy(allPaid, "despesa", true);
  const freeBalance =
    sumBy(allPaid, "receita", false) - sumBy(allPaid, "despesa", false);

  const aPagar = sumBy(transactions, "despesa", undefined, false);
  const aReceber = sumBy(transactions, "receita", undefined, false);

  const today = todayISO();
  const thirtyDaysAgo = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 30));
    return dt.toISOString().slice(0, 10);
  })();
  const last30Despesas = transactions
    .filter((t) => t.type === "despesa" && t.is_paid && t.date >= thirtyDaysAgo && t.date <= today)
    .reduce((s, t) => s + Number(t.amount), 0);
  const avgPerDay = last30Despesas / 30;
  const runwayDays = avgPerDay > 0 ? Math.floor(freeBalance / avgPerDay) : null;

  const topByOwner = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter((t) => t.type === "despesa").forEach((t) => {
      map.set(t.profile_id, (map.get(t.profile_id) ?? 0) + Number(t.amount));
    });
    const totalMonth = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return members.map((m) => ({
      profile: m,
      total: map.get(m.id) ?? 0,
      pct: totalMonth > 0 ? Math.round(((map.get(m.id) ?? 0) / totalMonth) * 100) : 0,
    }));
  }, [monthTx, members]);

  const fmt = (n: number) => (hideValues ? maskedBRL() : formatBRL(n));
  const fmtCompact = (n: number) => (hideValues ? maskedBRL() : formatBRLCompact(n));

  // ===== Filtros =====
  const [filter, setFilter] = useState<FilterMode>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "receita" | "despesa" | "investimento">("all");
  const [sort, setSort] = useState<SortMode>("recent");

  const filteredSorted = useMemo(() => {
    let arr = monthTx.slice();
    if (typeFilter !== "all") arr = arr.filter((t) => t.type === typeFilter);
    if (filter !== "all") arr = arr.filter((t) => t.profile_id === filter);
    arr.sort((a, b) => {
      if (sort === "recent") return b.date.localeCompare(a.date) || b.created_time.localeCompare(a.created_time);
      if (sort === "old") return a.date.localeCompare(b.date) || a.created_time.localeCompare(b.created_time);
      if (sort === "highest") return Number(b.amount) - Number(a.amount);
      return Number(a.amount) - Number(b.amount);
    });
    return arr;
  }, [monthTx, filter, typeFilter, sort]);

  // ===== Seleção múltipla =====
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const handleDeleteOne = async (id: string) => {
    unlockAudio();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    try { playDelete(); } catch { /* noop */ }
    toast.success("Transação excluída");
    await refresh();
  };

  const handleDeleteSelected = async () => {
    unlockAudio();
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("transactions").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    try { playDelete(); } catch { /* noop */ }
    toast.success(`${ids.length} transações excluídas`);
    clearSelection();
    await refresh();
  };

  if (authLoading || loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!activeProfile) return null;

  return (
    <div className="min-h-svh w-full bg-background pb-32">
      {/* Header sticky 100% width — conteúdo interno alinhado com main via .ffh-container */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/85 backdrop-blur-md">
        <div className="ffh-container">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <ProfileSwitcher />
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={toggleHideValues} aria-label="Ocultar valores">
                {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
              <PaletteSwitcher />
              <ThemeToggle />
              <Link to="/analytics"><Button variant="ghost" size="icon"><BarChart3 className="h-5 w-5" /></Button></Link>
              <Link to="/data"><Button variant="ghost" size="icon"><Database className="h-5 w-5" /></Button></Link>
              <Link to="/export"><Button variant="ghost" size="icon"><Download className="h-5 w-5" /></Button></Link>
              <Link to="/settings"><Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button></Link>
            </div>
          </div>
          <div className="border-t bg-background/60 px-4 py-2">
            <MonthNavigator monthKey={activeMonth} onChange={setActiveMonth} />
          </div>
        </div>
      </header>

      <main className="ffh-container space-y-5 px-4 pt-5">
        {/* 8 CARDS — grid 2 col mobile, 4 col desktop */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <SummaryCard label="Receitas (pagas)" value={fmtCompact(totalReceitasPagas)} icon={<ArrowDownCircle className="h-4 w-4" />} tone="success" />
          <SummaryCard label="Despesas (pagas)" value={fmtCompact(totalDespesasPagas)} icon={<ArrowUpCircle className="h-4 w-4" />} tone="destructive" />
          <SummaryCard label="Investimentos" value={fmtCompact(totalInvestPagas)} icon={<PiggyBank className="h-4 w-4" />} tone="investment" />
          <SummaryCard label="Saldo Livre" value={fmt(freeBalance)} icon={<Wallet className="h-4 w-4" />} tone="primary" highlight />
          <SummaryCard label="Saldo Benefícios" value={fmt(benefitBalance)} icon={<Sparkles className="h-4 w-4" />} tone="benefit" highlight />
          <SummaryCard label="A Pagar" value={fmtCompact(aPagar)} icon={<ArrowUpFromLine className="h-4 w-4" />} tone="warning" />
          <SummaryCard label="A Receber" value={fmtCompact(aReceber)} icon={<ArrowDownToLine className="h-4 w-4" />} tone="success" />
          <SummaryCard label="Média/dia (30d)" value={fmtCompact(avgPerDay)} icon={<Activity className="h-4 w-4" />} tone="muted" />
        </div>

        {/* Desktop: 2-col grid (runway+top à esquerda, lista à direita) */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-5 md:col-span-1">
            {/* RUNWAY */}
            <Card className="border-0 bg-gradient-to-br from-primary/15 via-card to-[color:var(--benefit)]/10">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Runway (caixa livre)</p>
                  <p className="text-base font-semibold">
                    {runwayDays === null
                      ? "Adicione despesas pagas para calcular"
                      : runwayDays > 365
                        ? `${Math.floor(runwayDays / 30)} meses ou mais`
                        : `${runwayDays} dia${runwayDays === 1 ? "" : "s"} de saldo`}
                  </p>
                  {runwayDays !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      Baseado em {fmt(avgPerDay)} de gasto médio/dia
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* TOP GASTOS */}
            {members.length > 1 && topByOwner.some((t) => t.total > 0) && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Top gastos do mês</p>
                  </div>
                  <div className="space-y-2">
                    {topByOwner.slice().sort((a, b) => b.total - a.total).map((row) => (
                      <div key={row.profile.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{row.profile.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {fmt(row.total)} • {row.pct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-[color:var(--benefit)]" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Lista (col-span-2 no desktop) */}
          <div className="space-y-3 md:col-span-2">
            {/* Toolbar: filtros perfil + tipo + ordem */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterChip>
                {members.map((m) => (
                  <FilterChip key={m.id} active={filter === m.id} onClick={() => setFilter(m.id)}>
                    {m.name}
                  </FilterChip>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
                {(["all", "receita", "despesa", "investimento"] as const).map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                    )}>
                    {t === "all" ? "Tudo" : t === "receita" ? "Rec." : t === "despesa" ? "Desp." : "Inv."}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {filteredSorted.length} movimentação(ões)
              </h2>
              <div className="flex items-center gap-2">
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs">
                  <option value="recent">Mais recentes</option>
                  <option value="old">Mais antigas</option>
                  <option value="highest">Maior valor</option>
                  <option value="lowest">Menor valor</option>
                </select>
                <Button size="sm" variant={selectMode ? "default" : "outline"} className="h-7"
                  onClick={() => { if (selectMode) clearSelection(); else setSelectMode(true); }}>
                  {selectMode ? <CheckSquare className="mr-1 h-3.5 w-3.5" /> : <Square className="mr-1 h-3.5 w-3.5" />}
                  {selectMode ? "Sair" : "Selecionar"}
                </Button>
              </div>
            </div>

            {selectMode && selectedIds.size > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2">
                <span className="text-xs font-medium">{selectedIds.size} selecionada(s)</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-7">
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir Selecionadas
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selectedIds.size} transações?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            <section className="space-y-2">
              {filteredSorted.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma movimentação para esses filtros.</p>
                  </CardContent>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {filteredSorted.map((t) => (
                    <li key={t.id}>
                      <TransactionCard
                        tx={t}
                        category={categories.find((c) => c.id === t.category_id) ?? null}
                        pm={paymentMethods.find((p) => p.id === t.payment_method_id) ?? null}
                        owner={members.find((m) => m.id === t.profile_id) ?? null}
                        author={members.find((m) => m.id === t.created_by_id) ?? null}
                        hideValues={hideValues}
                        isNew={newTxIds.has(t.id)}
                        onAcknowledge={() => acknowledgeNewTx(t.id)}
                        selectable={selectMode}
                        selected={selectedIds.has(t.id)}
                        onToggleSelect={() => toggleSelect(t.id)}
                        onDelete={() => handleDeleteOne(t.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>

      <Link to="/transaction/new" className="fixed bottom-6 right-6 z-20"
        style={{ paddingRight: "max(0px, env(safe-area-inset-right))" }}>
        <Button size="lg" className="h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/30" aria-label="Nova transação">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}

type Tone = "primary" | "benefit" | "success" | "destructive" | "warning" | "investment" | "muted";

function SummaryCard({ label, value, icon, tone, highlight }: {
  label: string; value: string; icon: React.ReactNode; tone: Tone; highlight?: boolean;
}) {
  const toneClasses: Record<Tone, { text: string; bg: string }> = {
    primary: { text: "text-primary-foreground", bg: "bg-gradient-to-br from-primary to-primary/70" },
    benefit: { text: "text-[color:var(--benefit-foreground)]", bg: "bg-gradient-to-br from-[color:var(--benefit)] to-[color:var(--benefit)]/70" },
    success: { text: "text-[color:var(--success)]", bg: "" },
    destructive: { text: "text-destructive", bg: "" },
    warning: { text: "text-[color:var(--warning)]", bg: "" },
    investment: { text: "text-[color:var(--investment)]", bg: "" },
    muted: { text: "text-foreground", bg: "" },
  };
  const t = toneClasses[tone];
  if (highlight) {
    return (
      <Card className={cn("overflow-hidden border-0 shadow-md", t.bg)}>
        <CardContent className={cn("space-y-1.5 p-3", t.text)}>
          <div className="flex items-center gap-1.5 text-[11px] opacity-90">{icon}{label}</div>
          <p className="text-lg font-semibold tracking-tight tabular-nums">{value}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={t.text}>{icon}</span>{label}
        </div>
        <p className={cn("text-base font-semibold tracking-tight tabular-nums", t.text)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
      )}>
      {children}
    </button>
  );
}
