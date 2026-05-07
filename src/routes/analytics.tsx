import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Wallet, TrendingDown, PieChart as PieChartIcon,
  TrendingUp, Flame, CalendarDays, Sparkles,
} from "lucide-react";
import { formatBRL, monthKeyFromISO, parseBRLInput, todayISO } from "@/lib/format";
import { MonthNavigator } from "@/components/MonthNavigator";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useFamilySettings } from "@/lib/use-family-settings";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import type { Transaction } from "@/lib/app-context";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
  "oklch(0.70 0.15 200)", "oklch(0.65 0.12 30)", "oklch(0.55 0.20 120)",
];

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function AnalyticsPage() {
  const { session, loading: authLoading } = useAuth();
  const { loading, activeProfile, members, categories, accounts, transactions, needsOnboarding, hideValues, toggleHideValues } = useApp();
  const { settings } = useFamilySettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const [activeMonth, setActiveMonth] = useState(() => monthKeyFromISO(todayISO()));
  const [accountFilter, setAccountFilter] = useState<string>("all"); // account.id | "all"
  const [natureFilter, setNatureFilter] = useState<"all" | "benefit" | "personal">("all");

  const monthTx = useMemo(() => {
    return transactions.filter((t) => {
      if (monthKeyFromISO(t.date) !== activeMonth) return false;
      if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
      if (natureFilter === "benefit" && !t.is_benefit) return false;
      if (natureFilter === "personal" && t.is_benefit) return false;
      return true;
    });
  }, [transactions, activeMonth, accountFilter, natureFilter]);

  // ===== Gastos por categoria (donut) =====
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter((t) => t.type === "despesa").forEach((t) => {
      const catName = categories.find((c) => c.id === t.category_id)?.name ?? "Sem categoria";
      map.set(catName, (map.get(catName) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx, categories]);

  // ===== Comparativo por membro =====
  const memberComparison = useMemo(() => {
    return members.map((m) => {
      const mTx = monthTx.filter((t) => t.profile_id === m.id);
      return {
        name: m.name,
        receita: mTx.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0),
        despesa: mTx.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0),
        investimento: mTx.filter((t) => t.type === "investimento").reduce((s, t) => s + Number(t.amount), 0),
      };
    });
  }, [monthTx, members]);

  // ===== Saldo livre vs gastos previstos (somente contas correntes) =====
  const correnteIds = new Set(accounts.filter((a) => a.type === "corrente").map((a) => a.id));
  const allPaid = transactions.filter((t) => t.is_paid);
  const freeBalance =
    allPaid.filter((t) => t.type === "receita" && correnteIds.has(t.account_id)).reduce((s, t) => s + Number(t.amount), 0) -
    allPaid.filter((t) => t.type === "despesa" && correnteIds.has(t.account_id)).reduce((s, t) => s + Number(t.amount), 0);
  const gastosPrevistos = transactions.filter((t) => t.type === "despesa" && !t.is_paid).reduce((s, t) => s + Number(t.amount), 0);

  // ===== Patrimônio Total (histórico completo) =====
  const totalReceitas = allPaid.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesas = allPaid.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const totalInvest = allPaid.filter((t) => t.type === "investimento").reduce((s, t) => s + Number(t.amount), 0);
  const patrimonio = totalReceitas - totalDespesas - totalInvest;

  // ===== FORECASTING: projeção baseada nos primeiros 15 dias =====
  const forecast = useMemo(() => {
    const [year, month] = activeMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const cutoff = 15;
    const first15 = monthTx.filter((t) => {
      const day = parseInt(t.date.split("-")[2], 10);
      return t.type === "despesa" && day <= cutoff;
    });
    const totalFirst15 = first15.reduce((s, t) => s + Number(t.amount), 0);
    const avgPerDay = totalFirst15 / cutoff;
    const projected = avgPerDay * daysInMonth;
    const totalActual = monthTx.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
    return { avgPerDay, projected, totalActual, daysInMonth, cutoff };
  }, [monthTx, activeMonth]);

  // ===== PARETO 80/20 =====
  const pareto = useMemo(() => {
    if (categoryData.length === 0) return { top: [], pct: 0 };
    const total = categoryData.reduce((s, d) => s + d.value, 0);
    let accum = 0;
    const top: typeof categoryData = [];
    for (const cat of categoryData) {
      accum += cat.value;
      top.push(cat);
      if (accum / total >= 0.8) break;
    }
    return { top, pct: total > 0 ? Math.round((accum / total) * 100) : 0 };
  }, [categoryData]);

  // ===== HEATMAP: frequência de gastos por dia da semana (últimos 3 meses) =====
  const heatmapData = useMemo(() => {
    const today = todayISO();
    const [y, m, d] = today.split("-").map(Number);
    const threeMonthsAgo = new Date(Date.UTC(y, m - 4, d));
    const startDate = threeMonthsAgo.toISOString().slice(0, 10);

    // Build week grid: rows = day of week (0-6), cols = weeks
    const dayCount = new Map<string, number>(); // "YYYY-MM-DD" -> count
    transactions
      .filter((t) => t.type === "despesa" && t.date >= startDate && t.date <= today)
      .forEach((t) => {
        dayCount.set(t.date, (dayCount.get(t.date) ?? 0) + 1);
      });

    // Build weeks array
    const weeks: { date: string; count: number; dow: number }[][] = [];
    let current = new Date(threeMonthsAgo);
    const endDate = new Date(Date.UTC(y, m - 1, d));
    let currentWeek: { date: string; count: number; dow: number }[] = [];

    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);
      const dow = current.getUTCDay();
      currentWeek.push({ date: dateStr, count: dayCount.get(dateStr) ?? 0, dow });
      if (dow === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current = new Date(current.getTime() + 86400000);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Aggregate by day of week
    const byDow = Array.from({ length: 7 }, () => 0);
    for (const [date, count] of dayCount) {
      const dow = new Date(date + "T00:00:00Z").getUTCDay();
      byDow[dow] += count;
    }

    const maxCount = Math.max(...Array.from(dayCount.values()), 1);
    return { weeks, byDow, maxCount, dayCount };
  }, [transactions]);

  // ===== Fútil simulator =====
  const futileMonth = useMemo(() => {
    return monthTx.filter((t) => t.type === "despesa" && t.is_futile).reduce((s, t) => s + Number(t.amount), 0);
  }, [monthTx]);
  const annualFutile = futileMonth * 12;
  const rates = [
    { key: "poupanca", label: "Poupança", value: settings.interest_poupanca },
    { key: "cdi", label: "CDI", value: settings.interest_cdi },
    { key: "custom", label: settings.interest_custom_label || "Custom", value: settings.interest_custom },
  ];
  const projectFV = (monthly: number, annualPct: number, years: number) => {
    const i = annualPct / 100 / 12;
    const n = years * 12;
    if (i === 0) return monthly * n;
    return monthly * ((Math.pow(1 + i, n) - 1) / i);
  };
  const [years, setYears] = useState(5);

  const totalDespesasMes = categoryData.reduce((s, d) => s + d.value, 0);

  if (authLoading || loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!activeProfile) return null;

  return (
    <>
      <DesktopSidebar hideValues={hideValues} toggleHideValues={toggleHideValues} />
      <div className="min-h-svh w-full bg-background pb-32 lg:pl-56">
      <header className="sticky top-0 z-30 w-full border-b bg-background/85 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-lg font-semibold">Análise</h1>
        </div>
        <div className="border-t bg-background/60 px-4 py-2">
          <MonthNavigator monthKey={activeMonth} onChange={setActiveMonth} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t bg-background/40 px-4 py-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium">Conta:</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs"
            >
              <option value="all">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium">Natureza:</span>
            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value as typeof natureFilter)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs"
            >
              <option value="all">Todos</option>
              <option value="benefit">Benefício</option>
              <option value="personal">Pessoal</option>
            </select>
          </label>
        </div>
      </header>

      <main className="space-y-5 px-4 pt-5 overflow-x-clip">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Donut — gastos por categoria */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Gastos por categoria</h2>
              </div>
              {categoryData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem despesas neste mês.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-52 w-52 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => formatBRL(Number(val))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 space-y-1.5 text-xs">
                    {categoryData.map((d, i) => (
                      <li key={d.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {d.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatBRL(d.value)} ({totalDespesasMes > 0 ? Math.round((d.value / totalDespesasMes) * 100) : 0}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar chart — comparativo por membro */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Comparativo no mês</h2>
              </div>
              {memberComparison.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberComparison} barCategoryGap="25%">
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
                      <Tooltip formatter={(val) => formatBRL(Number(val))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="receita" name="Receita" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="investimento" name="Invest." fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saldo Livre vs Gastos Previstos */}
        <Card className="border-0 bg-gradient-to-br from-primary/15 via-card to-[color:var(--benefit)]/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Saldo vs Previsão</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">Saldo Livre (pago)</p>
                <p className={`text-xl font-bold tabular-nums ${freeBalance >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                  {formatBRL(freeBalance)}
                </p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">Gastos Previstos</p>
                <p className="text-xl font-bold tabular-nums text-[color:var(--warning)]">
                  {formatBRL(gastosPrevistos)}
                </p>
              </div>
            </div>
            {gastosPrevistos > 0 && freeBalance > 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Após pagar tudo previsto, sobraria {formatBRL(freeBalance - gastosPrevistos)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* PATRIMÔNIO TOTAL */}
        <Card className="border-0 bg-gradient-to-br from-[color:var(--investment)]/15 via-card to-primary/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[color:var(--investment)]" />
              <h2 className="text-sm font-semibold">Patrimônio Total (histórico)</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-muted-foreground">Receitas</p>
                <p className="text-base font-bold tabular-nums text-[color:var(--success)]">{formatBRL(totalReceitas)}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-muted-foreground">Despesas</p>
                <p className="text-base font-bold tabular-nums text-destructive">{formatBRL(totalDespesas)}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-muted-foreground">Investimentos</p>
                <p className="text-base font-bold tabular-nums text-[color:var(--investment)]">{formatBRL(totalInvest)}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-muted-foreground">Saldo Acumulado</p>
                <p className={`text-base font-bold tabular-nums ${patrimonio >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>{formatBRL(patrimonio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FORECASTING */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Previsão de Gastos (Forecasting)</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Gasto atual</p>
                <p className="text-base font-bold tabular-nums">{formatBRL(forecast.totalActual)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Projeção ({forecast.daysInMonth}d)</p>
                <p className="text-base font-bold tabular-nums text-[color:var(--warning)]">{formatBRL(forecast.projected)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Média/dia (1-{forecast.cutoff})</p>
                <p className="text-base font-bold tabular-nums">{formatBRL(forecast.avgPerDay)}</p>
              </div>
            </div>
            {forecast.projected > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Progresso: {Math.round((forecast.totalActual / forecast.projected) * 100)}%</span>
                  <span>{formatBRL(forecast.totalActual)} / {formatBRL(forecast.projected)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-[color:var(--warning)] transition-all"
                    style={{ width: `${Math.min(100, (forecast.totalActual / forecast.projected) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PARETO 80/20 */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              <h2 className="text-sm font-semibold">Regra 80/20 (Pareto)</h2>
            </div>
            {pareto.top.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sem despesas para análise.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {pareto.top.length === 1 ? "1 categoria consome" : `${pareto.top.length} categorias consomem`} {pareto.pct}% do orçamento:
                </p>
                <div className="space-y-2">
                  {pareto.top.map((cat, i) => {
                    const pct = totalDespesasMes > 0 ? Math.round((cat.value / totalDespesasMes) * 100) : 0;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="font-medium">{cat.name}</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">{formatBRL(cat.value)} • {pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-destructive/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* HEATMAP */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Heatmap de Frequência (3 meses)</h2>
            </div>
            {/* Day-of-week summary */}
            <div className="mb-4 flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, dow) => {
                const maxDow = Math.max(...heatmapData.byDow, 1);
                const intensity = heatmapData.byDow[dow] / maxDow;
                return (
                  <div key={dow} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-medium"
                      style={{
                        backgroundColor: intensity === 0
                          ? "var(--muted)"
                          : `color-mix(in oklch, var(--primary) ${Math.round(intensity * 100)}%, var(--muted))`,
                        color: intensity > 0.5 ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      {heatmapData.byDow[dow]}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Calendar grid */}
            <div className="flex gap-[3px] overflow-x-auto pb-1">
              {heatmapData.weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }, (_, dow) => {
                    const cell = week.find((c) => c.dow === dow);
                    if (!cell) return <div key={dow} className="h-3 w-3 rounded-sm" />;
                    const intensity = cell.count / heatmapData.maxCount;
                    return (
                      <div
                        key={dow}
                        className="h-3 w-3 rounded-sm"
                        title={`${cell.date}: ${cell.count} despesa(s)`}
                        style={{
                          backgroundColor: cell.count === 0
                            ? "var(--muted)"
                            : `color-mix(in oklch, var(--primary) ${Math.round(Math.max(20, intensity * 100))}%, var(--muted))`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Dias mais escuros = mais transações de despesa
            </p>
          </CardContent>
        </Card>
        {/* SIMULADOR DE FÚTEIS */}
        <Card className="border-0 bg-gradient-to-br from-[color:var(--investment)]/15 via-card to-primary/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--investment)]" />
              <h2 className="text-sm font-semibold">E se você não gastasse com {settings.futile_label.toLowerCase()}?</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Gasto fútil no mês</p>
                <p className="text-base font-bold tabular-nums text-destructive">{formatBRL(futileMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Equivalente anual</p>
                <p className="text-base font-bold tabular-nums">{formatBRL(annualFutile)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Investido por</span>
              <Input
                type="number"
                min={1}
                max={40}
                value={years}
                onChange={(e) => {
                  const v = parseBRLInput(e.target.value);
                  setYears(Number.isFinite(v) && v > 0 ? Math.min(40, Math.round(v)) : 1);
                }}
                className="h-8 w-20"
              />
              <span className="text-[11px] text-muted-foreground">anos</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {rates.map((r) => (
                <div key={r.key} className="rounded-lg border border-border bg-card p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{r.label} ({r.value}% a.a.)</p>
                  <p className="text-sm font-bold tabular-nums text-[color:var(--investment)]">
                    {formatBRL(projectFV(futileMonth, r.value, years))}
                  </p>
                </div>
              ))}
            </div>
            {futileMonth === 0 && (
              <p className="text-[11px] text-center text-muted-foreground">
                Marque despesas como "{settings.futile_label}" no formulário para ver o impacto.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
      <BottomTabBar />
    </>
  );
}
