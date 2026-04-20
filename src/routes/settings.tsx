import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp, type Profile } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Copy,
  LogOut,
  Bell,
  BellOff,
  Database,
} from "lucide-react";
import { AvatarCropper } from "@/components/AvatarCropper";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme";
import {
  ensureServiceWorker,
  getPushPermission,
  isPushSupported,
  requestAndSubscribe,
  unsubscribePush,
} from "@/lib/push";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { signOut } = useAuth();
  const { activeProfile, members, family, refresh, resetLocal, loading } = useApp();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!loading && !activeProfile) navigate({ to: "/auth" });
  }, [activeProfile, loading, navigate]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushPerm("unsupported");
      return;
    }
    getPushPermission().then(setPushPerm);
    ensureServiceWorker();
  }, []);

  const handlePickAvatar = (profileId: string) => {
    setCropTargetId(profileId);
    fileRef.current?.click();
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropped = async (blob: Blob) => {
    const targetId = cropTargetId;
    setCropOpen(false);
    if (!targetId || !activeProfile) return;
    const path = `${activeProfile.user_id}/${targetId}-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      toast.error("Erro no upload: " + upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", targetId);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    toast.success("Foto atualizada!");
    await refresh();
  };

  const handleSaveName = async (p: Profile, newName: string) => {
    if (!newName.trim() || newName === p.name) {
      setEditingProfileId(null);
      return;
    }
    const { error } = await supabase.from("profiles").update({ name: newName.trim() }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Nome atualizado");
      setEditingProfileId(null);
      await refresh();
    }
  };

  const copyCode = () => {
    if (!family) return;
    navigator.clipboard.writeText(family.code);
    toast.success("Código copiado!");
  };

  const handleSignOut = async () => {
    resetLocal();
    await signOut();
    navigate({ to: "/auth" });
  };

  const handleEnablePush = async () => {
    if (!activeProfile || !family) return;
    const { VAPID_PUBLIC_KEY, HAS_VAPID_KEY } = await import("@/lib/vapid");
    if (!HAS_VAPID_KEY) {
      toast.error("Chave VAPID pública indisponível. Publique o app e tente novamente.");
      return;
    }
    const r = await requestAndSubscribe({
      profileId: activeProfile.id,
      familyId: family.id,
      userId: activeProfile.user_id,
      vapidPublicKey: VAPID_PUBLIC_KEY,
    });
    if (r.ok) {
      toast.success("Notificações ativadas!");
      setPushPerm("granted");
    } else {
      toast.error(r.reason ?? "Falha ao ativar notificações");
    }
  };

  const handleDisablePush = async () => {
    await unsubscribePush();
    setPushPerm("default");
    toast.success("Notificações desativadas");
  };

  if (!activeProfile) return null;

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Configurações</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="space-y-5 px-4 pt-5">
        {/* Perfis da família */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">Perfis da família</p>
              <p className="text-xs text-muted-foreground">
                Toque na foto para trocar o avatar.
              </p>
            </div>
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePickAvatar(m.id)}
                    className="relative shrink-0"
                  >
                    <Avatar className="h-14 w-14 border-2 border-primary/20">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {m.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Camera className="h-3 w-3" />
                    </span>
                  </button>
                  <div className="flex-1">
                    {editingProfileId === m.id ? (
                      <Input
                        autoFocus
                        defaultValue={m.name}
                        onBlur={(e) => handleSaveName(m, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingProfileId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProfileId(m.id)}
                        className="text-left"
                      >
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground">Toque para editar</p>
                      </button>
                    )}
                  </div>
                  {m.id === activeProfile.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Ativo
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Família */}
        {family && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold">Código da família</p>
                <p className="text-xs text-muted-foreground">
                  Compartilhe se quiser que outra conta também acesse.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-4 py-3 text-center text-xl font-mono tracking-[0.4em]">
                  {family.code}
                </code>
                <Button variant="outline" size="icon" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notificações Push */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">Notificações Push</p>
              <p className="text-xs text-muted-foreground">
                Receba alertas no celular quando o parceiro lançar uma transação. Funciona apenas
                no app publicado (não no preview do editor) e, no iOS, requer instalação como
                aplicativo na tela inicial.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                {pushPerm === "granted" ? (
                  <Bell className="h-4 w-4 text-[color:var(--success)]" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {pushPerm === "unsupported" && "Navegador sem suporte"}
                  {pushPerm === "default" && "Ainda não ativado"}
                  {pushPerm === "granted" && "Ativado neste dispositivo"}
                  {pushPerm === "denied" && "Bloqueado pelo navegador"}
                </span>
              </div>
              {pushPerm === "granted" ? (
                <Button size="sm" variant="outline" onClick={handleDisablePush}>
                  Desativar
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  disabled={pushPerm === "unsupported" || pushPerm === "denied"}
                >
                  Ativar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tema */}
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Aparência</p>
              <p className="text-xs text-muted-foreground">
                Atualmente: {theme === "dark" ? "Escuro" : "Claro"}
              </p>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>

        {/* Atalho config dados */}
        <Link to="/data" className="block">
          <Card className="transition-colors hover:bg-accent/40">
            <CardContent className="flex items-center gap-3 p-4">
              <Database className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Configurações de Dados</p>
                <p className="text-xs text-muted-foreground">
                  Categorias e formas de pagamento
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Sair */}
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>

      <AvatarCropper
        open={cropOpen}
        imageSrc={imageSrc}
        onClose={() => setCropOpen(false)}
        onCropped={handleCropped}
      />
    </div>
  );
}
