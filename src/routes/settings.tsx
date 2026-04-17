import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useApp, type Category, type PaymentMethod } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Copy,
  LogOut,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { AvatarCropper } from "@/components/AvatarCropper";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { signOut } = useAuth();
  const { profile, family, categories, paymentMethods, refresh, resetLocal, loading } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  const handleAvatarPicked = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropped = async (blob: Blob) => {
    if (!profile) return;
    setCropOpen(false);
    const path = `${profile.user_id}/avatar-${Date.now()}.jpg`;
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
      .eq("id", profile.id);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    toast.success("Foto atualizada!");
    await refresh();
  };

  const handleSaveName = async () => {
    if (!profile || !name.trim() || name === profile.name) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Nome atualizado");
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

  if (!profile) return null;

  return (
    <div className="min-h-svh bg-background pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Configurações</h1>
      </header>

      <div className="space-y-5 px-5 pt-5">
        {/* Perfil */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative"
              >
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {profile.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Camera className="h-3.5 w-3.5" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarPicked(f);
                  e.currentTarget.value = "";
                }}
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="profile-name">Seu nome</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSaveName}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Família */}
        {family && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-sm font-medium">Código da família</p>
                <p className="text-xs text-muted-foreground">
                  Compartilhe com seu parceiro para ele entrar.
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

        {/* Categorias */}
        <CategoriesSection categories={categories} familyId={family?.id ?? null} onChange={refresh} />

        {/* Formas de pagamento */}
        <PaymentMethodsSection
          items={paymentMethods}
          familyId={family?.id ?? null}
          onChange={refresh}
        />

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

// ================== CATEGORIES ==================
function CategoriesSection({
  categories,
  familyId,
  onChange,
}: {
  categories: Category[];
  familyId: string | null;
  onChange: () => Promise<void>;
}) {
  const [bulkType, setBulkType] = useState<"receita" | "despesa" | "investimento">("despesa");
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBulkAdd = async () => {
    if (!familyId) return;
    const names = bulk
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    const max = categories.length;
    const rows = names.map((name, i) => ({
      family_id: familyId,
      name,
      type: bulkType,
      sort_order: max + i,
    }));
    const { error } = await supabase.from("categories").insert(rows);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${names.length} categoria(s) criadas`);
      setBulk("");
      await onChange();
    }
  };

  const startEdit = (c: Category) => {
    setEditing(c.id);
    setEditName(c.name);
  };

  const saveEdit = async (c: Category) => {
    if (!editName.trim() || editName === c.name) {
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("categories").update({ name: editName.trim() }).eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoria atualizada");
      setEditing(null);
      await onChange();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta categoria? As transações ficarão sem categoria.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await onChange();
  };

  const move = async (c: Category, dir: -1 | 1) => {
    const sameType = categories.filter((x) => x.type === c.type);
    const idx = sameType.findIndex((x) => x.id === c.id);
    const swapWith = sameType[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("categories").update({ sort_order: swapWith.sort_order }).eq("id", c.id),
      supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", swapWith.id),
    ]);
    await onChange();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="text-sm font-semibold">Categorias</p>
          <p className="text-xs text-muted-foreground">
            Adicione várias separadas por vírgula ou em linhas.
          </p>
        </div>

        <div className="space-y-2">
          <Tabs value={bulkType} onValueChange={(v) => setBulkType(v as typeof bulkType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="despesa">Despesa</TabsTrigger>
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="investimento">Invest.</TabsTrigger>
            </TabsList>
          </Tabs>
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Mercado, Restaurante\nFarmácia"}
            rows={3}
          />
          <Button onClick={handleBulkAdd} disabled={busy || !bulk.trim()} size="sm" className="w-full">
            Adicionar
          </Button>
        </div>

        <ul className="divide-y">
          {(["despesa", "receita", "investimento"] as const).map((tp) => {
            const list = categories.filter((c) => c.type === tp);
            if (list.length === 0) return null;
            return (
              <li key={tp} className="py-2">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{tp}</p>
                <ul className="space-y-1">
                  {list.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                      {editing === c.id ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8"
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}>
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
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ================== PAYMENT METHODS ==================
function PaymentMethodsSection({
  items,
  familyId,
  onChange,
}: {
  items: PaymentMethod[];
  familyId: string | null;
  onChange: () => Promise<void>;
}) {
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBulkAdd = async () => {
    if (!familyId) return;
    const names = bulk
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    const max = items.length;
    const rows = names.map((name, i) => ({ family_id: familyId, name, sort_order: max + i }));
    const { error } = await supabase.from("payment_methods").insert(rows);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${names.length} forma(s) criadas`);
      setBulk("");
      await onChange();
    }
  };

  const saveEdit = async (p: PaymentMethod) => {
    if (!editName.trim() || editName === p.name) {
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("payment_methods").update({ name: editName.trim() }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Forma atualizada");
      setEditing(null);
      await onChange();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta forma de pagamento?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await onChange();
  };

  const move = async (p: PaymentMethod, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === p.id);
    const swapWith = items[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("payment_methods").update({ sort_order: swapWith.sort_order }).eq("id", p.id),
      supabase.from("payment_methods").update({ sort_order: p.sort_order }).eq("id", swapWith.id),
    ]);
    await onChange();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="text-sm font-semibold">Formas de pagamento</p>
          <p className="text-xs text-muted-foreground">
            Adicione várias separadas por vírgula ou em linhas.
          </p>
        </div>
        <div className="space-y-2">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Pix, Débito\nCrédito Nubank"}
            rows={3}
          />
          <Button onClick={handleBulkAdd} disabled={busy || !bulk.trim()} size="sm" className="w-full">
            Adicionar
          </Button>
        </div>
        <ul className="space-y-1">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              {editing === p.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(p.id); setEditName(p.name); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma forma cadastrada.</p>
          )}
        </ul>

        <Select onValueChange={(v) => v}>
          <SelectTrigger className="hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent />
        </Select>
      </CardContent>
    </Card>
  );
}
