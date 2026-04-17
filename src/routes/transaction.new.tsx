import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { DateInput } from "@/components/DateInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import { addMonthsISO, brToISO, todayBR } from "@/lib/format";

export const Route = createFileRoute("/transaction/new")({
  component: NewTransactionPage,
});

type TxType = "receita" | "despesa" | "investimento";

function NewTransactionPage() {
  const { profile, family, categories, paymentMethods, refresh, loading } = useApp();
  const navigate = useNavigate();

  // Ordem dos campos = ordem do card final:
  // 1) data, 2) tipo, 3) descrição/categoria, 4) valor,
  // 5) data pagamento, 6) forma pagamento, 7) pago, 8) benefício, 9) recorrência
  const [date, setDate] = useState(todayBR());
  const [type, setType] = useState<TxType>("despesa");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [pmId, setPmId] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(true);
  const [isBenefit, setIsBenefit] = useState(false);
  const [recurrence, setRecurrence] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [loading, profile, navigate]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !family) return;

    const iso = brToISO(date);
    if (!iso) {
      toast.error("Data inválida. Use DD/MM/AAAA.");
      return;
    }
    const value = parseFloat(amount.replace(",", "."));
    if (!isFinite(value) || value <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    const months = Math.max(1, Math.min(120, parseInt(recurrence || "1", 10) || 1));
    const paidIso = isPaid ? (brToISO(paidDate) ?? iso) : null;

    setBusy(true);

    // 1) Inserir transação mãe
    const { data: parentRows, error: parentErr } = await supabase
      .from("transactions")
      .insert({
        family_id: family.id,
        profile_id: profile.id,
        user_id: profile.user_id,
        type,
        description: description.trim(),
        amount: value,
        date: iso,
        category_id: categoryId,
        payment_method_id: pmId,
        is_paid: isPaid,
        is_benefit: isBenefit,
        recurrence_months: months,
        recurrence_index: 1,
        recurrence_parent_id: null,
        paid_date: paidIso,
      })
      .select("id")
      .single();

    if (parentErr || !parentRows) {
      setBusy(false);
      toast.error("Erro: " + (parentErr?.message ?? "desconhecido"));
      return;
    }

    // 2) Recorrência: inserir as parcelas restantes (Seção 2)
    if (months > 1) {
      const rest = Array.from({ length: months - 1 }, (_, i) => {
        const idx = i + 2;
        const nextIso = addMonthsISO(iso, i + 1);
        return {
          family_id: family.id,
          profile_id: profile.id,
          user_id: profile.user_id,
          type,
          description: description.trim(),
          amount: value,
          date: nextIso,
          category_id: categoryId,
          payment_method_id: pmId,
          is_paid: false,
          is_benefit: isBenefit,
          recurrence_months: months,
          recurrence_index: idx,
          recurrence_parent_id: parentRows.id,
          paid_date: null,
        };
      });
      const { error: childErr } = await supabase.from("transactions").insert(rest);
      if (childErr) {
        toast.error("Parcelas: " + childErr.message);
      }
    }

    await refresh();
    setBusy(false);
    toast.success("Transação adicionada!");
    navigate({ to: "/dashboard" });
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

      <form onSubmit={handleSubmit} className="space-y-4 px-5 pt-5">
        <Card>
          <CardContent className="space-y-4 p-4">
            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <DateInput id="date" required value={date} onChange={setDate} />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Tabs value={type} onValueChange={(v) => { setType(v as TxType); setCategoryId(null); }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="despesa">Despesa</TabsTrigger>
                  <TabsTrigger value="receita">Receita</TabsTrigger>
                  <TabsTrigger value="investimento">Invest.</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Mercado da semana"
              />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <SearchableSelect
                options={filteredCategories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Selecione uma categoria"
                emptyText="Crie categorias em Configurações"
              />
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            {/* Data de pagamento */}
            <div className="space-y-2">
              <Label htmlFor="paid-date">Data de pagamento</Label>
              <DateInput
                id="paid-date"
                value={paidDate}
                onChange={setPaidDate}
                placeholder="opcional — usa a data acima"
              />
            </div>

            {/* Forma de pagamento */}
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <SearchableSelect
                options={paymentMethods.map((p) => ({ value: p.id, label: p.name }))}
                value={pmId}
                onChange={setPmId}
                placeholder="Selecione uma forma"
                emptyText="Crie formas em Configurações"
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Pago?</p>
                <p className="text-xs text-muted-foreground">
                  Conta para os saldos quando ligado
                </p>
              </div>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">É benefício?</p>
                <p className="text-xs text-muted-foreground">
                  Vai para o caixa restrito de benefícios
                </p>
              </div>
              <Switch checked={isBenefit} onCheckedChange={setIsBenefit} />
            </div>

            {/* Recorrência */}
            <div className="space-y-2">
              <Label htmlFor="rec">Recorrência (meses)</Label>
              <Input
                id="rec"
                type="number"
                min={1}
                max={120}
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se {">"} 1, criamos as parcelas automaticamente nos próximos meses.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Salvando..." : "Adicionar"}
        </Button>
      </form>
    </div>
  );
}
