import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  Settings,
  Plus,
  Download,
  TrendingUp,
  Sparkles,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  PiggyBank,
  Calendar,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingDown,
  Database,
} from "lucide-react";
import {
  formatBRL,
  formatBRLCompact,
  maskedBRL,
  monthKeyFromISO,
  monthLabel,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteSwitcher } from "@/components/PaletteSwitcher";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionCard } from "@/components/TransactionCard";
import type { Transaction } from "@/lib/app-context";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type FilterMode = "all" | "receita" | "despesa" | "investimento" | string; // string = profile_id
type SortMode = "recent" | "old" | "highest" | "lowest";

function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const {
    loading,
    activeProfile,
    members,
    categories,
    paymentMethods,
    transactions,
    hideValues,
    toggleHideValues,
    needsOnboarding,
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const monthKeys = useMemo(() => {
    const set = new Set<string>();
    set.add(monthKeyFromISO(todayISO()));
    transactions.forEach((t) => set.add(monthKeyFromISO(t.date)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const [activeMonth, setActiveMonth] = useState<string>(() => monthKeyFromISO(todayISO()));
  useEffect(() => {
    if (!monthKeys.includes(activeMonth) && monthKeys[0]) setActiveMonth(monthKeys[0]);
  }, [monthKeys, activeMonth]);

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );

  // ===== 8 CARDS — calculados em CIMA do mês ativo (exceto saldos que são totais) =====
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

  // Média de gastos/dia: despesas pagas dos últimos 30 dias / 30
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

  // Runway em dias: caixa livre / média diária
  const runwayDays = avgPerDay > 0 ? Math.floor(freeBalance / avgPerDay) : null;

  // Top gastos do mês ativo por owner (profile_id)
  const topByOwner = useMemo(() => {
    const map = new Map<string, number>();
    monthTx
      .filter((t) => t.type === "despesa")
      .forEach((t) => {
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

  // ===== Filtros e ordenação =====
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("recent");

  const filteredSorted = useMemo(() => {
    let arr = monthTx.slice();
    if (filter === "receita" || filter === "despesa" || filter === "investimento") {
      arr = arr.filter((t) => t.type === filter);
    } else if (filter !== "all") {
      // profile_id
      arr = arr.filter((t) => t.profile_id === filter);
    }
    arr.sort((a, b) => {
      if (sort === "recent") return b.date.localeCompare(a.date) || b.created_time.localeCompare(a.created_time);
      if (sort === "old") return a.date.localeCompare(b.date) || a.created_time.localeCompare(b.created_time);
      if (sort === "highest") return Number(b.amount) - Number(a.amount);
      return Number(a.amount) - Number(b.amount);
    });
    return arr;
  }, [monthTx, filter, sort]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!activeProfile) return null;

  return (
    <div className="min-h-svh bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <ProfileSwitcher />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={toggleHideValues} aria-label="Ocultar valores">
              {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <ThemeToggle />
            <Link to="/data">
              <Button variant="ghost" size="icon" aria-label="Configurações de Dados">
                <Database className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/export">
              <Button variant="ghost" size="icon" aria-label="Exportar">
                <Download className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon" aria-label="Configurações">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="space-y-5 px-4 pt-5">
        {/* ============== 8 CARDS ============== */}
        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard
            label="Receitas (pagas)"
            value={fmtCompact(totalReceitasPagas)}
            icon={<ArrowDownCircle className="h-4 w-4" />}
            tone="success"
          />
          <SummaryCard
            label="Despesas (pagas)"
            value={fmtCompact(totalDespesasPagas)}
            icon={<ArrowUpCircle className="h-4 w-4" />}
            tone="destructive"
          />
          <SummaryCard
            label="Investimentos"
            value={fmtCompact(totalInvestPagas)}
            icon={<PiggyBank className="h-4 w-4" />}
            tone="investment"
          />
          <SummaryCard
            label="Saldo Livre"
            value={fmt(freeBalance)}
            icon={<Wallet className="h-4 w-4" />}
            tone="primary"
            highlight
          />
          <SummaryCard
            label="Saldo Benefícios"
            value={fmt(benefitBalance)}
            icon={<Sparkles className="h-4 w-4" />}
            tone="benefit"
            highlight
          />
          <SummaryCard
            label="A Pagar"
            value={fmtCompact(aPagar)}
            icon={<ArrowUpFromLine className="h-4 w-4" />}
            tone="warning"
          />
          <SummaryCard
            label="A Receber"
            value={fmtCompact(aReceber)}
            icon={<ArrowDownToLine className="h-4 w-4" />}
            tone="success"
          />
          <SummaryCard
            label="Média/dia (30d)"
            value={fmtCompact(avgPerDay)}
            icon={<Activity className="h-4 w-4" />}
            tone="muted"
          />
        </div>

        {/* ============== RUNWAY ============== */}
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

        {/* ============== TOP GASTOS ============== */}
        {members.length > 1 && topByOwner.some((t) => t.total > 0) && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Top gastos do mês</p>
              </div>
              <div className="space-y-2">
                {topByOwner
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((row) => (
                    <div key={row.profile.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{row.profile.name}</span>
                        <span className="text-muted-foreground">
                          {fmt(row.total)} • {row.pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-[color:var(--benefit)]"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== TABS DE MÊS ============== */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-1">
            {monthKeys.map((mk) => (
              <button
                key={mk}
                onClick={() => setActiveMonth(mk)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  activeMonth === mk
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {monthLabel(mk)}
              </button>
            ))}
          </div>
        </div>

        {/* ============== FILTROS RÁPIDOS ============== */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-1">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              Todos
            </FilterChip>
            {members.map((m) => (
              <FilterChip
                key={m.id}
                active={filter === m.id}
                onClick={() => setFilter(m.id)}
              >
                {m.name}
              </FilterChip>
            ))}
            <FilterChip active={filter === "receita"} onClick={() => setFilter("receita")}>
              Receitas
            </FilterChip>
            <FilterChip active={filter === "despesa"} onClick={() => setFilter("despesa")}>
              Despesas
            </FilterChip>
            <FilterChip
              active={filter === "investimento"}
              onClick={() => setFilter("investimento")}
            >
              Invest.
            </FilterChip>
          </div>
        </div>

        {/* ============== ORDENAÇÃO ============== */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {filteredSorted.length} movimentação(ões)
          </h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs"
          >
            <option value="recent">Mais recentes</option>
            <option value="old">Mais antigas</option>
            <option value="highest">Maior valor</option>
            <option value="lowest">Menor valor</option>
          </select>
        </div>

        {/* ============== LISTA ============== */}
        <section className="space-y-2">
          {filteredSorted.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma movimentação para esses filtros.
                </p>
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
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* FAB */}
      <Link
        to="/transaction/new"
        className="fixed bottom-6 right-6 z-20"
        style={{ paddingRight: "max(0px, env(safe-area-inset-right))" }}
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/30"
          aria-label="Nova transação"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}

// ============== COMPONENTES INTERNOS ==============

type Tone = "primary" | "benefit" | "success" | "destructive" | "warning" | "investment" | "muted";

function SummaryCard({
  label,
  value,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: Tone;
  highlight?: boolean;
}) {
  const toneClasses: Record<Tone, { ring: string; text: string; bg: string }> = {
    primary: {
      ring: "ring-primary/30",
      text: "text-primary-foreground",
      bg: "bg-gradient-to-br from-primary to-primary/70",
    },
    benefit: {
      ring: "ring-[color:var(--benefit)]/30",
      text: "text-[color:var(--benefit-foreground)]",
      bg: "bg-gradient-to-br from-[color:var(--benefit)] to-[color:var(--benefit)]/70",
    },
    success: { ring: "", text: "text-[color:var(--success)]", bg: "" },
    destructive: { ring: "", text: "text-destructive", bg: "" },
    warning: { ring: "", text: "text-[color:var(--warning)]", bg: "" },
    investment: { ring: "", text: "text-[color:var(--investment)]", bg: "" },
    muted: { ring: "", text: "text-foreground", bg: "" },
  };
  const t = toneClasses[tone];

  if (highlight) {
    return (
      <Card className={cn("overflow-hidden border-0 shadow-md", t.bg)}>
        <CardContent className={cn("space-y-1.5 p-3", t.text)}>
          <div className="flex items-center gap-1.5 text-[11px] opacity-90">
            {icon}
            {label}
          </div>
          <p className="text-lg font-semibold tracking-tight">{value}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-1.5 p-3">
        <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground")}>
          <span className={t.text}>{icon}</span>
          {label}
        </div>
        <p className={cn("text-base font-semibold tracking-tight", t.text)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
