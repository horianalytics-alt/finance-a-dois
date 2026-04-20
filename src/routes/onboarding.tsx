import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import { writeActiveProfileId } from "@/lib/active-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Heart, Plus, Users, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

type Mode = "choose" | "create" | "join" | "join-pick";

function OnboardingPage() {
  const { session, loading: authLoading } = useAuth();
  const { activeProfile, members, loading, refresh } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Quando bate o limite de 2 perfis na família e precisamos
  // mostrar o picker "Quem é você?"
  const [pickFamilyId, setPickFamilyId] = useState<string | null>(null);
  const [pickProfiles, setPickProfiles] = useState<{ id: string; name: string }[]>([]);

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

  // Etapa 1 do "join": valida código + conta perfis. Se já tem 2, mostra picker.
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Informe o código.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("count_family_profiles_by_code", {
        _code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) {
        toast.error("Código de família inválido.");
        return;
      }

      // Já tem 2: bloqueia criação de novo, busca lista pra picker
      if (row.profile_count >= 2) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("family_id", row.family_id)
          .order("created_at");
        if (profErr) throw profErr;
        setPickFamilyId(row.family_id);
        setPickProfiles((profs ?? []).map((p) => ({ id: p.id, name: p.name })));
        setMode("join-pick");
        return;
      }

      // 0 ou 1 perfil: pode criar o seu pra completar o par
      if (!name1.trim()) {
        toast.error("Informe seu nome para criar o perfil.");
        return;
      }
      const { data: joinData, error: joinErr } = await supabase.rpc(
        "join_family_and_create_profile",
        { _code: code.trim().toUpperCase(), _name: name1.trim() },
      );
      if (joinErr) throw joinErr;
      const joinRow = joinData?.[0];
      if (joinRow?.profile_id) writeActiveProfileId(joinRow.profile_id);
      toast.success("Bem-vindo(a) à família!");
      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  };

  const handlePickProfile = async (profileId: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_profile", {
        _profile_id: profileId,
      });
      if (error) throw error;
      const row = data?.[0];
      if (row?.profile_id) writeActiveProfileId(row.profile_id);
      toast.success("Perfil vinculado à sua conta!");
      await refresh();
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao vincular perfil.";
      if (msg.includes("already have a profile")) {
        toast.error("Você já tem um perfil nesta família.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-5">
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
          </div>
          <CardTitle>Vamos começar</CardTitle>
          <CardDescription>
            {mode === "choose" && "Crie a família com os dois perfis ou entre com o código."}
            {mode === "create" && "Como vocês se chamam?"}
            {mode === "join" && "Insira o código e seu nome."}
            {mode === "join-pick" && "Escolha o seu perfil para continuar."}
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
                <Input
                  id="n1"
                  required
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="Ex: Heitor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n2">Nome do parceiro 2</Label>
                <Input
                  id="n2"
                  required
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  placeholder="Ex: Carol"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Você poderá alternar entre os dois perfis no header do app, estilo Netflix.
              </p>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Criando..." : "Criar Família"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("choose")}
              >
                Voltar
              </Button>
            </form>
          )}
          {mode === "join" && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
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
                <Label htmlFor="jname">Seu nome (caso a família tenha vaga)</Label>
                <Input
                  id="jname"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="Ex: João"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se a família já tiver 2 perfis, vamos te mostrar quem está nela.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Verificando..." : "Continuar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("choose")}
              >
                Voltar
              </Button>
            </form>
          )}
          {mode === "join-pick" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                Selecione o perfil que é seu. Ele será vinculado à sua conta.
              </div>
              {pickProfiles.map((p) => (
                <Button
                  key={p.id}
                  size="lg"
                  variant="outline"
                  className="h-14 w-full justify-start gap-3 rounded-xl"
                  onClick={() => handlePickProfile(p.id)}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-base">{p.name}</span>
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setMode("join");
                  setPickFamilyId(null);
                  setPickProfiles([]);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              {pickFamilyId && (
                <p className="text-center text-[10px] text-muted-foreground">
                  ID: {pickFamilyId.slice(0, 8)}…
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
