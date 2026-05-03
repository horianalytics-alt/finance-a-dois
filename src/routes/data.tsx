import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type Account, type AccountType, type Category, type PaymentMethod, type TxType } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowDown,
  ArrowUp,
  Sparkles,
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  CreditCard,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/data")({
  component: DataPage,
});

function DataPage() {
  const { activeProfile, family, categories, paymentMethods, accounts, refresh, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !activeProfile) navigate({ to: "/auth" });
  }, [loading, activeProfile, navigate]);

  if (!activeProfile || !family) return null;

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Configurações de Dados</h1>
      </header>

      <div className="px-4 pt-4">
        <Tabs defaultValue="receita" className="space-y-3">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="receita" className="gap-1 text-[11px]">
              <ArrowDownCircle className="h-3.5 w-3.5" />
              Rec.
            </TabsTrigger>
            <TabsTrigger value="despesa" className="gap-1 text-[11px]">
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Desp.
            </TabsTrigger>
            <TabsTrigger value="investimento" className="gap-1 text-[11px]">
              <PiggyBank className="h-3.5 w-3.5" />
              Inv.
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-1 text-[11px]">
              <CreditCard className="h-3.5 w-3.5" />
              Pagto.
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1 text-[11px]">
              <Wallet className="h-3.5 w-3.5" />
              Contas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="receita">
            <CategorySection
              type="receita"
              categories={categories.filter((c) => c.type === "receita")}
              familyId={family.id}
              onChange={refresh}
              icon={<ArrowDownCircle className="h-4 w-4 text-[color:var(--success)]" />}
              title="Categorias de Receita"
            />
          </TabsContent>
          <TabsContent value="despesa">
            <CategorySection
              type="despesa"
              categories={categories.filter((c) => c.type === "despesa")}
              familyId={family.id}
              onChange={refresh}
              icon={<ArrowUpCircle className="h-4 w-4 text-destructive" />}
              title="Categorias de Despesa"
            />
          </TabsContent>
          <TabsContent value="investimento">
            <CategorySection
              type="investimento"
              categories={categories.filter((c) => c.type === "investimento")}
              familyId={family.id}
              onChange={refresh}
              icon={<PiggyBank className="h-4 w-4 text-[color:var(--investment)]" />}
              title="Categorias de Investimento"
            />
          </TabsContent>
          <TabsContent value="payment">
            <PaymentSection items={paymentMethods} familyId={family.id} onChange={refresh} />
          </TabsContent>
          <TabsContent value="account">
            <AccountSection items={accounts} familyId={family.id} onChange={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ====================== CATEGORY SECTION ======================
function CategorySection({
  type,
  categories,
  familyId,
  onChange,
  icon,
  title,
}: {
  type: TxType;
  categories: Category[];
  familyId: string;
  onChange: () => Promise<void>;
  icon: React.ReactNode;
  title: string;
}) {
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleBulk = async () => {
    const names = bulk
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    try {
      const max = categories.length;
      const rows = names.map((name, i) => ({
        family_id: familyId,
        name,
        type,
        sort_order: max + i,
      }));
      const { error } = await supabase.from("categories").insert(rows);
      if (error) throw error;
      toast.success(`${names.length} categoria(s) adicionada(s)`);
      setBulk("");
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (c: Category) => {
    if (!editName.trim() || editName === c.name) {
      setEditing(null);
      return;
    }
    try {
      const { error } = await supabase
        .from("categories")
        .update({ name: editName.trim() })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Atualizada");
      setEditing(null);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta categoria? As transações ficarão sem categoria.")) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const move = async (c: Category, dir: -1 | 1) => {
    const idx = categories.findIndex((x) => x.id === c.id);
    const swapWith = categories[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        supabase.from("categories").update({ sort_order: swapWith.sort_order }).eq("id", c.id),
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", swapWith.id),
      ]);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
        </div>

        <div className="space-y-2">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Adicione várias separadas por vírgula ou em linhas:\nMercado, Restaurante\nFarmácia"}
            rows={3}
          />
          <Button onClick={handleBulk} disabled={busy || !bulk.trim()} size="sm" className="w-full">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        <ul className="space-y-1">
          {categories.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma categoria ainda
            </li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              {editing === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(c)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(c, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(c, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(c.id);
                      setEditName(c.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ====================== PAYMENT SECTION ======================
function PaymentSection({
  items,
  familyId,
  onChange,
}: {
  items: PaymentMethod[];
  familyId: string;
  onChange: () => Promise<void>;
}) {
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleBulk = async () => {
    const names = bulk
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    try {
      const max = items.length;
      const rows = names.map((name, i) => ({
        family_id: familyId,
        name,
        sort_order: max + i,
      }));
      const { error } = await supabase.from("payment_methods").insert(rows);
      if (error) throw error;
      toast.success(`${names.length} forma(s) adicionada(s)`);
      setBulk("");
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (p: PaymentMethod) => {
    if (!editName.trim() || editName === p.name) {
      setEditing(null);
      return;
    }
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ name: editName.trim() })
        .eq("id", p.id);
      if (error) throw error;
      toast.success("Atualizada");
      setEditing(null);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta forma de pagamento?")) return;
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const move = async (p: PaymentMethod, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === p.id);
    const swapWith = items[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        supabase.from("payment_methods").update({ sort_order: swapWith.sort_order }).eq("id", p.id),
        supabase.from("payment_methods").update({ sort_order: p.sort_order }).eq("id", swapWith.id),
      ]);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Formas de Pagamento</p>
        </div>

        <div className="space-y-2">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Pix, Débito\nCrédito Nubank"}
            rows={3}
          />
          <Button onClick={handleBulk} disabled={busy || !bulk.trim()} size="sm" className="w-full">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        <ul className="space-y-1">
          {items.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma forma cadastrada
            </li>
          )}
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              {editing === p.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(p)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(p.id);
                      setEditName(p.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ====================== ACCOUNT SECTION ======================
function AccountSection({
  items,
  familyId,
  onChange,
}: {
  items: Account[];
  familyId: string;
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("corrente");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("corrente");

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("accounts").insert({
        family_id: familyId,
        name: name.trim(),
        type,
        sort_order: items.length,
      });
      if (error) throw error;
      toast.success("Conta adicionada");
      setName("");
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (a: Account) => {
    if (!editName.trim()) {
      setEditing(null);
      return;
    }
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ name: editName.trim(), type: editType })
        .eq("id", a.id);
      if (error) throw error;
      toast.success("Atualizada");
      setEditing(null);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta? Transações vinculadas precisam ser remanejadas antes.")) return;
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro (talvez existam transações vinculadas)");
    }
  };

  const move = async (a: Account, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === a.id);
    const swapWith = items[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        supabase.from("accounts").update({ sort_order: swapWith.sort_order }).eq("id", a.id),
        supabase.from("accounts").update({ sort_order: a.sort_order }).eq("id", swapWith.id),
      ]);
      await onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Contas</p>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da conta (ex: Nubank, Cartão Alelo)"
          />
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="corrente">Conta Corrente / Cartão</option>
              <option value="beneficio">Cartão Benefício (VR/VT/etc)</option>
            </select>
            <Button onClick={handleAdd} disabled={busy || !name.trim()} size="sm">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contas de tipo <strong>Benefício</strong> aparecem como saldo separado no Dashboard.
          </p>
        </div>

        <ul className="space-y-1">
          {items.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada</li>
          )}
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              {editing === a.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AccountType)}
                    className="h-8 rounded-md border border-border bg-background px-1 text-xs"
                  >
                    <option value="corrente">Corrente</option>
                    <option value="beneficio">Benefício</option>
                  </select>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(a)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">
                    {a.name}
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                      {a.type === "beneficio" ? "Benefício" : "Corrente"}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(a, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(a, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(a.id);
                      setEditName(a.name);
                      setEditType(a.type);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
