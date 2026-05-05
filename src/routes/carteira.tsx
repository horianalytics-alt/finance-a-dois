import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp, type Account, type Transaction } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, CreditCard, Sparkles, Wallet, TrendingUp, TrendingDown,
  Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { formatBRL, isoToBR, maskedBRL, monthKeyFromISO, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MonthNavigator } from "@/components/MonthNavigator";

export const Route = createFileRoute("/carteira")({
  component: CarteiraPage,
});

function CarteiraPage() {
  const { session, loading: authLoading } = useAuth();
  const { loading, accounts, transactions, hideValues, toggleHideValues, needsOnboarding, activeProfile } = useApp();
  const navigate = useNavigate();

  const [activeMonth, setActiveMonth] = useState<string>(() => monthKeyFromISO(todayISO()));

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );

  const cards = useMemo(() => {
    return accounts
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((account) => {
        const txs = monthTx.filter((t) => t.account_id === account.id);
        const paid = txs.filter((t) => t.is_paid);
        const receitas = paid.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
        const despesas = paid.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
        const balance = receitas - despesas;
        const usagePct = receitas > 0 ? Math.min(100, Math.round((despesas / receitas) * 100)) : 0;
        const health: CardProps["health"] =
          receitas === 0 && despesas === 0
            ? "neutral"
            : balance >= 0
              ? usagePct < 70
                ? "great"
                : "ok"
              : "bad";
        const recent = txs
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || b.created_time.localeCompare(a.created_time))
          .slice(0, 5);
        return { account, balance, receitas, despesas, usagePct, health, recent };
      });
  }, [accounts, monthTx]);

  // ===== KPI: Eficiência de Benefício (analítico, baseado em is_benefit) =====
  const benefitKpi = useMemo(() => {
    const benefitAcc = accounts.find((a) => a.type === "beneficio");
    const benefitDesp = monthTx.filter((t) => t.type === "despesa" && t.is_benefit);
    const total = benefitDesp.reduce((s, t) => s + Number(t.amount), 0);
    const viaBenefit = benefitAcc
      ? benefitDesp.filter((t) => t.account_id === benefitAcc.id).reduce((s, t) => s + Number(t.amount), 0)
      : 0;
    const ownPocket = total - viaBenefit;
    const efficiency = total > 0 ? (viaBenefit / total) * 100 : 100;
    return { total, viaBenefit, ownPocket, efficiency, hasBenefitAcc: !!benefitAcc };
  }, [monthTx, accounts]);

  const fmt = (n: number) => (hideValues ? maskedBRL() : formatBRL(n));

  if (authLoading || loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!activeProfile) return null;

  return (
    <>
      <DesktopSidebar hideValues={hideValues} toggleHideValues={toggleHideValues} />
      <div className="min-h-svh w-full bg-background pb-32 lg:pl-56">
        <header className="sticky top-0 z-30 w-full border-b bg-background">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="lg:hidden">
                <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <h1 className="text-lg font-semibold">Carteira</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleHideValues} aria-label="Ocultar valores">
              {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
          <div className="border-t bg-background/60 px-4 py-2">
            <MonthNavigator monthKey={activeMonth} onChange={setActiveMonth} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pt-5">
          {cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
                <Link to="/data" className="text-xs text-primary hover:underline">Cadastrar conta</Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {cards.map((c) => <AccountCard key={c.account.id} {...c} fmt={fmt} />)}
              {benefitKpi.hasBenefitAcc && <BenefitEfficiencyCard kpi={benefitKpi} fmt={fmt} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

interface CardProps {
  account: Account;
  balance: number;
  receitas: number;
  despesas: number;
  usagePct: number;
  health: "neutral" | "great" | "ok" | "bad";
  recent: Transaction[];
  fmt: (n: number) => string;
}

function AccountCard({ account, balance, receitas, despesas, usagePct, health, recent, fmt }: CardProps) {
  const isBenefit = account.type === "beneficio";
  const gradient = isBenefit
    ? "from-[color:var(--benefit)] via-[color:var(--benefit)]/80 to-[color:var(--benefit)]/60"
    : "from-primary via-primary/80 to-primary/60";
  const healthLabel: Record<typeof health, string> = {
    neutral: "Sem movimentações",
    great: "Saudável",
    ok: "Atenção",
    bad: "Crítico",
  };
  const healthTone: Record<typeof health, string> = {
    neutral: "bg-muted text-muted-foreground",
    great: "bg-[color:var(--success)]/20 text-[color:var(--success)]",
    ok: "bg-[color:var(--warning)]/20 text-[color:var(--warning-foreground)]",
    bad: "bg-destructive/20 text-destructive",
  };

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      {/* Card visual estilo cartão de crédito */}
      <div className={cn("relative bg-gradient-to-br p-5 text-white", gradient)}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(0,0,0,0.3) 0%, transparent 50%)",
        }} />
        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            {/* Chip */}
            <div className="h-9 w-12 rounded-md bg-gradient-to-br from-yellow-200/80 to-yellow-500/60 shadow-inner" />
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">{isBenefit ? "Benefício" : "Conta"}</p>
              <p className="text-lg font-semibold">{account.name}</p>
            </div>
          </div>
          {isBenefit ? <Sparkles className="h-7 w-7 opacity-90" /> : <Wallet className="h-7 w-7 opacity-90" />}
        </div>
        <div className="relative mt-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest opacity-80">Saldo atual</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{fmt(balance)}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm", healthTone[health])}>
            {healthLabel[health]}
          </span>
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" /> Entradas
            </div>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[color:var(--success)]">{fmt(receitas)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Saídas
            </div>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-destructive">{fmt(despesas)}</p>
          </div>
        </div>

        {/* Barra de uso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Uso (saídas / entradas)</span>
            <span className="tabular-nums">{usagePct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usagePct < 70 ? "bg-[color:var(--success)]" : usagePct < 100 ? "bg-[color:var(--warning)]" : "bg-destructive",
              )}
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
        </div>

        {/* Últimas movimentações */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Últimas movimentações</p>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((t) => {
                const sign = t.type === "receita" ? "+" : t.type === "despesa" ? "-" : "•";
                const color =
                  t.type === "receita"
                    ? "text-[color:var(--success)]"
                    : t.type === "despesa"
                      ? "text-destructive"
                      : "text-[color:var(--investment)]";
                return (
                  <li key={t.id}>
                    <Link
                      to="/transaction/$id"
                      params={{ id: t.id }}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground">{isoToBR(t.date)}</p>
                      </div>
                      <span className={cn("shrink-0 font-semibold tabular-nums", color)}>
                        {sign}
                        {fmt(Number(t.amount))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
