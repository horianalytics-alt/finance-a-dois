import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, TrendingDown, PieChart as PieChartIcon } from "lucide-react";
import { formatBRL, monthKeyFromISO, todayISO } from "@/lib/format";
import { MonthNavigator } from "@/components/MonthNavigator";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
  "oklch(0.70 0.15 200)", "oklch(0.65 0.12 30)", "oklch(0.55 0.20 120)",
];

function AnalyticsPage() {
  const { session, loading: authLoading } = useAuth();
  const { loading, activeProfile, members, categories, transactions, needsOnboarding } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
    else if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [session, authLoading, needsOnboarding, navigate]);

  const [activeMonth, setActiveMonth] = useState(() => monthKeyFromISO(todayISO()));

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyFromISO(t.date) === activeMonth),
    [transactions, activeMonth],
  );

  // Gastos por categoria (donut)
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

  // Comparativo por membro (bar chart)
  const memberComparison = useMemo(() => {
    const result: { name: string; receita: number; despesa: number; investimento: number }[] = [];
    for (const m of members) {
      const mTx = monthTx.filter((t) => t.profile_id === m.id);
      result.push({
        name: m.name,
        receita: mTx.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0),
        despesa: mTx.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0),
        investimento: mTx.filter((t) => t.type === "investimento").reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return result;
  }, [monthTx, members]);

  // Saldo livre vs gastos previstos
  const allPaid = transactions.filter((t) => t.is_paid);
  const totalReceitasPagas = allPaid.filter((t) => t.type === "receita" && !t.is_benefit).reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesasPagas = allPaid.filter((t) => t.type === "despesa" && !t.is_benefit).reduce((s, t) => s + Number(t.amount), 0);
  const freeBalance = totalReceitasPagas - totalDespesasPagas;
  const gastosPrevistos = transactions.filter((t) => t.type === "despesa" && !t.is_paid).reduce((s, t) => s + Number(t.amount), 0);

  if (authLoading || loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!activeProfile) return null;

  const totalDespesasMes = categoryData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-svh w-full bg-background pb-16">
      <header className="sticky top-0 z-30 w-full border-b bg-background/85 backdrop-blur-md">
        <div className="ffh-container flex items-center gap-2 px-4 py-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-lg font-semibold">Análise</h1>
        </div>
        <div className="ffh-container border-t bg-background/60 px-4 py-2">
          <MonthNavigator monthKey={activeMonth} onChange={setActiveMonth} />
        </div>
      </header>

      <main className="ffh-container space-y-5 px-4 pt-5">
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
                        <Pie
                          data={categoryData}
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          stroke="none"
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => formatBRL(val)}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        />
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
                      <Tooltip formatter={(val: number) => formatBRL(val)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
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

        {/* Resumo: Saldo Livre vs Gastos Previstos */}
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
      </main>
    </div>
  );
}
