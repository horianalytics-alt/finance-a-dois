import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/DateInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, X } from "lucide-react";
import { useApp, type Transaction, type TxType } from "@/lib/app-context";
import { brToISO, isoToBR, parseBRLInput, todayBR } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TransactionFormValue {
  date: string; // ISO
  type: TxType;
  description: string;
  category_id: string | null;
  amount: number;
  paid_date: string | null;
  payment_method_id: string | null;
  account_id: string;
  is_paid: boolean;
  is_benefit: boolean;
  recurrence_months: number;
  owner_profile_id: string;
}

interface ExtraRow {
  id: string;
  description: string;
  category_id: string | null;
  amount: string;
  owner_profile_id: string;
  type: TxType;
  payment_method_id: string | null;
  account_id: string | null;
  is_paid: boolean;
  is_benefit: boolean;
}

interface Props {
  initial?: Partial<Transaction>;
  busy?: boolean;
  submitLabel?: string;
  /** Callback de salvar. Recebe um array — vindo do form principal e (opcionalmente) extras. */
  onSubmit: (values: TransactionFormValue[]) => Promise<void> | void;
  onCancel?: () => void;
  hideRecurrence?: boolean; // ao editar recorrente, não permitimos mudar
  /** Habilita o "+ Adicionar outra transação" (lote) — só na criação. */
  allowBulk?: boolean;
}

export function TransactionForm({
  initial,
  busy,
  submitLabel = "Salvar",
  onSubmit,
  onCancel,
  hideRecurrence,
  allowBulk = false,
}: Props) {
  const { categories, paymentMethods, accounts, members, activeProfile } = useApp();

  const defaultAccountId = (initial as Partial<Transaction> | undefined)?.account_id ?? null;

  const [date, setDate] = useState(() =>
    initial?.date ? isoToBR(initial.date) : todayBR(),
  );
  const [type, setType] = useState<TxType>(initial?.type ?? "despesa");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount).replace(".", ",") : "",
  );
  const [paidDate, setPaidDate] = useState(initial?.paid_date ? isoToBR(initial.paid_date) : "");
  const [pmId, setPmId] = useState<string | null>(initial?.payment_method_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? true);
  const [isBenefit, setIsBenefit] = useState(initial?.is_benefit ?? false);
  const [recurrence, setRecurrence] = useState(String(initial?.recurrence_months ?? 1));
  const [ownerId, setOwnerId] = useState<string>(
    initial?.profile_id ?? activeProfile?.id ?? "",
  );
  const [extras, setExtras] = useState<ExtraRow[]>([]);

  // Quando muda type, limpa categoria se não for compatível
  useEffect(() => {
    if (categoryId && !categories.find((c) => c.id === categoryId && c.type === type)) {
      setCategoryId(null);
    }
  }, [type, categoryId, categories]);

  // Garante owner padrão = active profile, se ainda vazio
  useEffect(() => {
    if (!ownerId && activeProfile) setOwnerId(activeProfile.id);
  }, [ownerId, activeProfile]);

  // Default conta = primeira conta corrente disponível
  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    const corrente = accounts.find((a) => a.type === "corrente");
    setAccountId((corrente ?? accounts[0]).id);
  }, [accountId, accounts]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const accountLabel = type === "receita" ? "Conta de Destino" : "Conta de Origem";

  const addExtra = () => {
    setExtras((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: "",
        category_id: null,
        amount: "",
        owner_profile_id: ownerId || activeProfile?.id || "",
        type,
        payment_method_id: pmId,
        account_id: accountId,
        is_paid: isPaid,
        is_benefit: isBenefit,
      },
    ]);
  };

  const updateExtra = (id: string, patch: Partial<ExtraRow>) => {
    setExtras((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeExtra = (id: string) => {
    setExtras((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const iso = brToISO(date);
    if (!iso) {
      toast.error("Data inválida. Use DD/MM/AAAA.");
      return;
    }
    const value = parseBRLInput(amount);
    if (!isFinite(value) || value <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    const months = Math.max(1, Math.min(120, parseInt(recurrence || "1", 10) || 1));
    const paidIso = isPaid ? (brToISO(paidDate) ?? iso) : null;
    if (!ownerId) {
      toast.error("Selecione o responsável.");
      return;
    }
    if (!accountId) {
      toast.error("Selecione a conta.");
      return;
    }

    const main: TransactionFormValue = {
      date: iso,
      type,
      description: description.trim(),
      category_id: categoryId,
      amount: value,
      paid_date: paidIso,
      payment_method_id: pmId,
      account_id: accountId,
      is_paid: isPaid,
      is_benefit: isBenefit,
      recurrence_months: months,
      owner_profile_id: ownerId,
    };

    const all: TransactionFormValue[] = [main];
    for (const r of extras) {
      const v = parseBRLInput(r.amount);
      if (!r.description.trim()) {
        toast.error(`Descrição vazia em uma das transações em lote.`);
        return;
      }
      if (!isFinite(v) || v <= 0) {
        toast.error(`Valor inválido em "${r.description}".`);
        return;
      }
      if (!r.owner_profile_id) {
        toast.error(`Responsável vazio em "${r.description}".`);
        return;
      }
      if (!r.account_id) {
        toast.error(`Conta não selecionada em "${r.description}".`);
        return;
      }
      all.push({
        date: iso, // herda data do principal
        type: r.type,
        description: r.description.trim(),
        category_id: r.category_id,
        amount: v,
        paid_date: r.is_paid ? (brToISO(paidDate) ?? iso) : null,
        payment_method_id: r.payment_method_id,
        account_id: r.account_id,
        is_paid: r.is_paid,
        is_benefit: r.is_benefit,
        recurrence_months: 1,
        owner_profile_id: r.owner_profile_id,
      });
    }

    await onSubmit(all);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
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
              emptyText="Crie categorias em Configurações de Dados"
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
          {/* Responsável */}
          {members.length > 1 && (
            <div className="space-y-2">
              <Label>Responsável (dono dessa transação)</Label>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setOwnerId(m.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      ownerId === m.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-accent/40",
                    )}
                  >
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {m.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Conta (origem/destino) */}
          <div className="space-y-2">
            <Label>{accountLabel}</Label>
            <SearchableSelect
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={accountId}
              onChange={setAccountId}
              placeholder="Selecione uma conta"
              emptyText="Crie contas em Configurações de Dados"
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
              emptyText="Crie formas em Configurações de Dados"
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
          {!hideRecurrence && (
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
                Se {">"} 1, criamos uma transação mãe e geramos as parcelas dos próximos meses.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============== LOTE ============== */}
      {allowBulk && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
              <p className="text-sm font-semibold">Lote rápido</p>
              <p className="text-xs text-muted-foreground">
                Cada item tem seus próprios controles.
              </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addExtra}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar outra
              </Button>
            </div>

            {extras.length > 0 && (
              <ul className="space-y-2">
                {extras.map((row) => {
                  const cats = categories.filter((c) => c.type === row.type);
                  return (
                    <li
                      key={row.id}
                      className="space-y-2 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Tabs
                          value={row.type}
                          onValueChange={(v) => updateExtra(row.id, { type: v as TxType, category_id: null })}
                          className="flex-1"
                        >
                          <TabsList className="grid w-full grid-cols-3 h-8">
                            <TabsTrigger value="despesa" className="text-xs h-6">Desp.</TabsTrigger>
                            <TabsTrigger value="receita" className="text-xs h-6">Rec.</TabsTrigger>
                            <TabsTrigger value="investimento" className="text-xs h-6">Inv.</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive"
                          onClick={() => removeExtra(row.id)}
                          aria-label="Remover linha"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Descrição"
                        value={row.description}
                        onChange={(e) => updateExtra(row.id, { description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <SearchableSelect
                          options={cats.map((c) => ({ value: c.id, label: c.name }))}
                          value={row.category_id}
                          onChange={(v) => updateExtra(row.id, { category_id: v })}
                          placeholder="Categoria"
                        />
                        <Input
                          inputMode="decimal"
                          placeholder="Valor (R$)"
                          value={row.amount}
                          onChange={(e) => updateExtra(row.id, { amount: e.target.value })}
                        />
                      </div>
                      {/* Forma de pagamento */}
                      <SearchableSelect
                        options={paymentMethods.map((p) => ({ value: p.id, label: p.name }))}
                        value={row.payment_method_id}
                        onChange={(v) => updateExtra(row.id, { payment_method_id: v })}
                        placeholder="Forma de pagamento"
                      />
                      {/* Toggles Pago + Benefício */}
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs">
                          <Switch checked={row.is_paid} onCheckedChange={(v) => updateExtra(row.id, { is_paid: v })} />
                          Pago?
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Switch checked={row.is_benefit} onCheckedChange={(v) => updateExtra(row.id, { is_benefit: v })} />
                          Benefício?
                        </label>
                      </div>
                      {members.length > 1 && (
                        <div className="grid grid-cols-2 gap-1">
                          {members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateExtra(row.id, { owner_profile_id: m.id })}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                                row.owner_profile_id === m.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:bg-accent/40",
                              )}
                            >
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={m.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[8px]">
                                  {m.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
          {busy
            ? "Salvando..."
            : extras.length > 0
              ? `${submitLabel} (${extras.length + 1})`
              : submitLabel}
        </Button>
      </div>
    </form>
  );
}
