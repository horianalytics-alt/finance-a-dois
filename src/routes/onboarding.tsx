import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { writeActiveProfileId } from "@/lib/active-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Heart, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { session, loading: authLoading } = useAuth();
  const { activeProfile, members, loading, refresh } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/auth" });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    if (!loading && activeProfile && members.length > 0) navigate({ to: "/dashboard" });
  }, [activeProfile, members.length, loading, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name1.trim() || !name2.trim()) {
      toast.error("Informe o nome dos dois perfis.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_family_with_two_profiles", {
        _name1: name1.trim(),
        _name2: name2.trim(),
      });
      if (error) throw error;
      const fam = data?.[0];
      if (fam?.profile1_id) writeActiveProfileId(fam.profile1_id);
      toast.success(`Família criada! Código: ${fam?.family_code}`);
      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar família.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name1.trim() || !code.trim()) {
      toast.error("Informe nome e código.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("join_family_and_create_profile", {
        _code: code.trim().toUpperCase(),
        _name: name1.trim(),
      });
      if (error) throw error;
      const row = data?.[0];
      if (row?.profile_id) writeActiveProfileId(row.profile_id);
      toast.success("Bem-vindo(a) à família!");
      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
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
            {mode === "choose" && "Crie a família com os dois perfis ou entre com o código."}
            {mode === "create" && "Como vocês se chamam?"}
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
                <Label htmlFor="n1">Nome do parceiro 1</Label>
                <Input id="n1" required value={name1} onChange={(e) => setName1(e.target.value)} placeholder="Ex: Heitor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n2">Nome do parceiro 2</Label>
                <Input id="n2" required value={name2} onChange={(e) => setName2(e.target.value)} placeholder="Ex: Carol" />
              </div>
              <p className="text-xs text-muted-foreground">
                Você poderá alternar entre os dois perfis no header do app, estilo Netflix.
              </p>
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
                <Input id="jname" required value={name1} onChange={(e) => setName1(e.target.value)} placeholder="Ex: João" />
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
