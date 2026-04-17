import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp, type Transaction } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Eye,
  EyeOff,
  Settings,
  Plus,
  Download,
  ArrowDown,
  ArrowUp,
  TrendingUp,
  Sparkles,
  Wallet,
  Clock,
} from "lucide-react";
import {
  formatBRL,
  maskedBRL,
  monthKeyFromISO,
  monthLabel,
  isoToBR,
  formatCreatedTime,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const {
    loading,
    profile,
    members,
    categories,
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

  // organiza meses disponíveis (a partir das transações + mês atual)
  const monthKeys = useMemo(() => {
    const set = new Set<string>();
    set.add(monthKeyFromISO(todayISO()));
    transactions.forEach((t) => set.add(monthKeyFromISO(t.date)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const [activeMonth, setActiveMonth] = useState<string>(() => monthKeyFromISO(todayISO()));

  useEffect(() => {
    if (!monthKeys.includes(activeMonth) && monthKeys[0]) {
      setActiveMonth(monthKeys[0]);
    }
  }, [monthKeys, activeMonth]);

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );

  // Saldos (Seção 2): Benefício e Livre, considerando TODAS as transações pagas
  const allPaid = transactions.filter((t) => t.is_paid);
  const sumBy = (list: Transaction[], type: "receita" | "despesa", isBenefit: boolean) =>
    list
      .filter((t) => t.type === type && t.is_benefit === isBenefit)
      .reduce((s, t) => s + Number(t.amount), 0);

  const benefitBalance =
    sumBy(allPaid, "receita", true) - sumBy(allPaid, "despesa", true);
  const freeBalance = sumBy(allPaid, "receita", false) - sumBy(allPaid, "despesa", false);

  // Contas a pagar / receber: somente NÃO pagas, separadas por caixa
  const unpaid = transactions.filter((t) => !t.is_paid);
  const toPayFree = unpaid
    .filter((t) => t.type === "despesa" && !t.is_benefit)
    .reduce((s, t) => s + Number(t.amount), 0);
  const toPayBenefit = unpaid
    .filter((t) => t.type === "despesa" && t.is_benefit)
    .reduce((s, t) => s + Number(t.amount), 0);
  const toReceiveFree = unpaid
    .filter((t) => t.type === "receita" && !t.is_benefit)
    .reduce((s, t) => s + Number(t.amount), 0);
  const toReceiveBenefit = unpaid
    .filter((t) => t.type === "receita" && t.is_benefit)
    .reduce((s, t) => s + Number(t.amount), 0);

  const fmt = (n: number) => (hideValues ? maskedBRL() : formatBRL(n));

  if (authLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-svh bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Olá,</p>
              <p className="font-semibold leading-tight">{profile.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleHideValues} aria-label="Ocultar valores">
              {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
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

      <main className="space-y-5 px-5 pt-5">
        {/* Caixas - hero cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-xs opacity-90">
                <Wallet className="h-3.5 w-3.5" /> Caixa Livre
              </div>
              <p className="text-xl font-semibold tracking-tight">{fmt(freeBalance)}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-[var(--benefit)] to-[var(--benefit)]/70 text-[color:var(--benefit-foreground)] shadow-md">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-xs opacity-90">
                <Sparkles className="h-3.5 w-3.5" /> Benefícios
              </div>
              <p className="text-xl font-semibold tracking-tight">{fmt(benefitBalance)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Contas a pagar/receber */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDown className="h-3.5 w-3.5 text-destructive" /> A pagar
              </div>
              <p className="text-sm font-medium">{fmt(toPayFree)} <span className="text-xs text-muted-foreground">livre</span></p>
              <p className="text-sm font-medium">{fmt(toPayBenefit)} <span className="text-xs text-muted-foreground">benef.</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUp className="h-3.5 w-3.5 text-[color:var(--success)]" /> A receber
              </div>
              <p className="text-sm font-medium">{fmt(toReceiveFree)} <span className="text-xs text-muted-foreground">livre</span></p>
              <p className="text-sm font-medium">{fmt(toReceiveBenefit)} <span className="text-xs text-muted-foreground">benef.</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Membros */}
        {members.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Família:</span>
            <div className="flex -space-x-2">
              {members.map((m) => (
                <Avatar key={m.id} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}

        {/* Tabs de mês */}
        <div className="-mx-5 overflow-x-auto px-5">
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

        {/* Lista do mês */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            Movimentações de {monthLabel(activeMonth)}
          </h2>
          {monthTx.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma movimentação neste mês.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {monthTx.map((t) => {
                const cat = categories.find((c) => c.id === t.category_id);
                const member = members.find((m) => m.id === t.profile_id);
                const sign = t.type === "receita" ? "+" : t.type === "despesa" ? "-" : "•";
                const valueColor =
                  t.type === "receita"
                    ? "text-[color:var(--success)]"
                    : t.type === "despesa"
                      ? "text-destructive"
                      : "text-[color:var(--benefit)]";
                return (
                  <li key={t.id}>
                    <Card className="border-l-4" style={{
                      borderLeftColor: t.is_benefit
                        ? "var(--benefit)"
                        : t.type === "receita"
                          ? "var(--success)"
                          : t.type === "despesa"
                            ? "var(--destructive)"
                            : "var(--primary)",
                    }}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-medium">{t.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {isoToBR(t.date)}
                              {cat ? ` • ${cat.name}` : ""}
                              {member ? ` • ${member.name}` : ""}
                              {t.recurrence_months > 1
                                ? ` • ${t.recurrence_index}/${t.recurrence_months}`
                                : ""}
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Clock className="h-2.5 w-2.5" />
                              {formatCreatedTime(t.created_time)}
                              {!t.is_paid && (
                                <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--warning-foreground)]">
                                  Pendente
                                </span>
                              )}
                              {t.is_benefit && (
                                <span className="ml-1 rounded-full bg-[color:var(--benefit)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--benefit)]">
                                  Benefício
                                </span>
                              )}
                            </p>
                          </div>
                          <div className={cn("text-right text-sm font-semibold", valueColor)}>
                            {sign}
                            {fmt(Number(t.amount))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* FAB */}
      <Link to="/transaction/new" className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0">
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
