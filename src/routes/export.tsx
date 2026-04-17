import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download } from "lucide-react";
import { DateInput } from "@/components/DateInput";
import { brToISO, isoToBR, monthLabel, todayISO } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/export")({
  component: ExportPage,
});

type Mode = "month" | "week" | "range";

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 dom .. 6 sáb
  const diff = day; // tomamos domingo como início
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  return d.toISOString().slice(0, 10);
}

function escapeCsv(v: string): string {
  if (/[";\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function ExportPage() {
  const { transactions, categories, paymentMethods, profile, loading } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("month");

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [loading, profile, navigate]);

  // mês
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(todayISO().slice(0, 7));
    transactions.forEach((t) => set.add(t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);
  const [month, setMonth] = useState<string>(() => todayISO().slice(0, 7));
  useEffect(() => {
    if (!monthOptions.includes(month) && monthOptions[0]) setMonth(monthOptions[0]);
  }, [monthOptions, month]);

  // range custom
  const [from, setFrom] = useState(isoToBR(todayISO()));
  const [to, setTo] = useState(isoToBR(todayISO()));

  const handleExport = () => {
    let fromIso: string;
    let toIso: string;
    let label: string;

    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      fromIso = `${month}-01`;
      toIso = `${month}-${String(last).padStart(2, "0")}`;
      label = `mes_${month}`;
    } else if (mode === "week") {
      fromIso = startOfWeekISO();
      toIso = endOfWeekISO();
      label = `semana_${fromIso}`;
    } else {
      const f = brToISO(from);
      const t = brToISO(to);
      if (!f || !t) {
        alert("Datas inválidas");
        return;
      }
      fromIso = f;
      toIso = t;
      label = `range_${fromIso}_${toIso}`;
    }

    const filtered = transactions
      .filter((t) => t.date >= fromIso && t.date <= toIso)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Cabeçalho EXATO da Seção 6:
    // data de lançamento ; coluna vazia ; tipo ; descrição/categoria ; valor ; data de pagamento ; forma de pagamento ; Pago
    const header = [
      "data de lançamento",
      "",
      "tipo",
      "descrição/categoria",
      "valor",
      "data de pagamento",
      "forma de pagamento",
      "Pago",
    ];
    const rows = filtered.map((t) => {
      const cat = categories.find((c) => c.id === t.category_id)?.name ?? "";
      const pm = paymentMethods.find((p) => p.id === t.payment_method_id)?.name ?? "";
      const descCat = cat ? `${t.description} / ${cat}` : t.description;
      // valor PT-BR (vírgula decimal) — Excel BR aceita
      const valor = Number(t.amount).toFixed(2).replace(".", ",");
      return [
        isoToBR(t.date),
        "",
        t.type,
        descCat,
        valor,
        t.paid_date ? isoToBR(t.paid_date) : "",
        pm,
        t.is_paid ? "Sim" : "Não",
      ];
    });
    const csv =
      "\ufeff" +
      [header, ...rows].map((r) => r.map((c) => escapeCsv(String(c))).join(";")).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financas_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Exportar relatório</h1>
      </header>

      <div className="space-y-5 px-5 pt-5">
        <Card>
          <CardContent className="space-y-4 p-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="month">Mês</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="range">Período</TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "month" && (
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((mk) => (
                      <SelectItem key={mk} value={mk}>
                        {monthLabel(mk)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "week" && (
              <p className="text-sm text-muted-foreground">
                Esta semana ({isoToBR(startOfWeekISO())} – {isoToBR(endOfWeekISO())})
              </p>
            )}

            {mode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>De</Label>
                  <DateInput value={from} onChange={setFrom} />
                </div>
                <div className="space-y-2">
                  <Label>Até</Label>
                  <DateInput value={to} onChange={setTo} />
                </div>
              </div>
            )}

            <Button onClick={handleExport} className="w-full" size="lg">
              <Download className="mr-2 h-4 w-4" /> Baixar CSV
            </Button>

            <p className="text-xs text-muted-foreground">
              Formato CSV separado por <code className="rounded bg-muted px-1">;</code>{" "}
              compatível com Excel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
