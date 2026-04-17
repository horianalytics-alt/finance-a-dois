import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Heart, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const DEFAULT_CATEGORIES: { name: string; type: "receita" | "despesa" | "investimento" }[] = [
  { name: "Salário", type: "receita" },
  { name: "Outras receitas", type: "receita" },
  { name: "Mercado", type: "despesa" },
  { name: "Restaurante", type: "despesa" },
  { name: "Transporte", type: "despesa" },
  { name: "Moradia", type: "despesa" },
  { name: "Lazer", type: "despesa" },
  { name: "Saúde", type: "despesa" },
  { name: "Investimentos", type: "investimento" },
];

const DEFAULT_PMS = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto"];

async function seedDefaults(familyId: string) {
  // só semeia se vazio
  const [{ count: catCount }, { count: pmCount }] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("family_id", familyId),
  ]);
  if ((catCount ?? 0) === 0) {
    await supabase.from("categories").insert(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, family_id: familyId, sort_order: i })),
    );
  }
  if ((pmCount ?? 0) === 0) {
    await supabase.from("payment_methods").insert(
      DEFAULT_PMS.map((name, i) => ({ name, family_id: familyId, sort_order: i })),
    );
  }
}

function OnboardingPage() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading, refresh } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    if (!loading && profile) navigate({ to: "/dashboard" });
  }, [profile, loading, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_family_and_profile", { _name: name.trim() });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const fam = data?.[0];
    if (fam?.family_id) {
      await seedDefaults(fam.family_id);
      toast.success(`Família criada! Código: ${fam.family_code}`);
    }
    await refresh();
    setBusy(false);
    navigate({ to: "/dashboard" });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_family_and_create_profile", {
      _code: code.trim().toUpperCase(),
      _name: name.trim(),
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo(a) à família!");
    await refresh();
    setBusy(false);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-5">
      <Card className="w-full border-0 bg-transparent shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
          </div>
          <CardTitle>Vamos começar</CardTitle>
          <CardDescription>
            {mode === "choose" && "Crie uma família ou entre com o código do seu parceiro."}
            {mode === "create" && "Como você quer ser chamado(a)?"}
            {mode === "join" && "Insira o código e seu nome."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "choose" && (
            <>
              <Button
                size="lg"
                className="h-14 w-full justify-start gap-3 rounded-xl"
                onClick={() => setMode("create")}
              >
                <Plus className="h-5 w-5" />
                <span className="text-base">Criar uma Família</span>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-14 w-full justify-start gap-3 rounded-xl"
                onClick={() => setMode("join")}
              >
                <Users className="h-5 w-5" />
                <span className="text-base">Entrar com Código</span>
              </Button>
            </>
          )}
          {mode === "create" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ana" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Criando..." : "Criar Família"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choose")}>
                Voltar
              </Button>
            </form>
          )}
          {mode === "join" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código da família</Label>
                <Input
                  id="code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: AB23CD"
                  maxLength={6}
                  className="tracking-widest text-center text-lg uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jname">Seu nome</Label>
                <Input id="jname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Entrando..." : "Entrar na Família"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choose")}>
                Voltar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
