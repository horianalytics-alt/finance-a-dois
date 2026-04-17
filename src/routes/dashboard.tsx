import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type Family = { id: string; name: string; invite_code: string };
type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  occurred_on: string;
  user_id: string;
};

function DashboardPage() {
  const { session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth" });
    }
  }, [session, authLoading, navigate]);

  const loadFamily = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data: member, error: memberErr } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (memberErr) {
      toast.error("Erro ao carregar família: " + memberErr.message);
      setLoading(false);
      return;
    }

    if (!member) {
      setFamily(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    const { data: fam, error: famErr } = await supabase
      .from("families")
      .select("id, name, invite_code")
      .eq("id", member.family_id)
      .maybeSingle();

    if (famErr || !fam) {
      toast.error("Erro ao carregar família");
      setLoading(false);
      return;
    }
    setFamily(fam);

    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("id, description, amount, type, category, occurred_on, user_id")
      .eq("family_id", fam.id)
      .order("occurred_on", { ascending: false });

    if (txErr) {
      toast.error("Erro ao carregar transações: " + txErr.message);
    } else {
      setTransactions((txs ?? []) as Transaction[]);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadFamily();
  }, [session, loadFamily]);

  if (authLoading || !session) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <h1 className="text-xl font-semibold">Finanças do Casal</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {loading ? (
          <p>Carregando...</p>
        ) : !family ? (
          <FamilySetup onUpdated={loadFamily} />
        ) : (
          <>
            <FamilyCard family={family} />
            <NewTransactionForm familyId={family.id} userId={session.user.id} onCreated={loadFamily} />
            <TransactionsList transactions={transactions} />
          </>
        )}
      </main>
    </div>
  );
}

function FamilySetup({ onUpdated }: { onUpdated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_family", { _name: name });
    setBusy(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Família criada!");
      onUpdated();
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("join_family_by_code", {
      _invite_code: code.trim().toUpperCase(),
    });
    setBusy(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Você entrou na família!");
      onUpdated();
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Criar uma Família</CardTitle>
          <CardDescription>Comece uma nova família e gere um código de convite</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fname">Nome da família</Label>
              <Input id="fname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Casa Silva" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Criar Família</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entrar com Código</CardTitle>
          <CardDescription>Use o código compartilhado pelo seu parceiro</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de convite</Label>
              <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: AB23CDEF" maxLength={8} />
            </div>
            <Button type="submit" variant="secondary" className="w-full" disabled={busy}>Entrar na Família</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FamilyCard({ family }: { family: Family }) {
  const copy = () => {
    navigator.clipboard.writeText(family.invite_code);
    toast.success("Código copiado!");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{family.name}</CardTitle>
        <CardDescription>Compartilhe o código com seu parceiro para que ele entre</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <code className="rounded bg-muted px-4 py-2 text-lg font-mono tracking-widest">
          {family.invite_code}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>Copiar</Button>
      </CardContent>
    </Card>
  );
}

function NewTransactionForm({
  familyId,
  userId,
  onCreated,
}: {
  familyId: string;
  userId: string;
  onCreated: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      family_id: familyId,
      user_id: userId,
      description,
      amount: parseFloat(amount),
      type,
      category: category || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Transação adicionada!");
      setDescription("");
      setAmount("");
      setCategory("");
      onCreated();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Transação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input required type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="opcional" />
          </div>
          <div className="md:col-span-5">
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Adicionar"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TransactionsList({ transactions }: { transactions: Transaction[] }) {
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Receitas</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{fmt(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Despesas</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{fmt(totalExpense)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Saldo</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(balance)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma transação ainda.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(t.occurred_on).toLocaleDateString("pt-BR")}
                      {t.category ? ` • ${t.category}` : ""}
                    </p>
                  </div>
                  <span className={t.type === "income" ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                    {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
