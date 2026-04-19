// Componente que pede permissão de Push (com bot frioto), registra Service Worker
// e salva subscription no banco. Funciona apenas no app PUBLICADO (HTTPS, fora do iframe).
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import {
  ensureServiceWorker,
  getPushPermission,
  isPushSupported,
  requestAndSubscribe,
  unsubscribePush,
} from "@/lib/push";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";
import { toast } from "sonner";

export function PushButton() {
  const { activeProfile, family } = useApp();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!isPushSupported()) {
      setPerm("unsupported");
      return;
    }
    void getPushPermission().then(setPerm);
    void ensureServiceWorker();
  }, []);

  if (perm === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Notificações não suportadas neste navegador. No iOS, instale como app na tela inicial primeiro.
      </p>
    );
  }

  const enabled = perm === "granted";

  const enable = async () => {
    if (!activeProfile || !family || !session) return;
    setBusy(true);
    try {
      const r = await requestAndSubscribe({
        profileId: activeProfile.id,
        familyId: family.id,
        userId: session.user.id,
        vapidPublicKey: VAPID_PUBLIC_KEY,
      });
      if (r.ok) {
        toast.success("Notificações ativadas!");
        setPerm("granted");
      } else {
        toast.error(r.reason ?? "Não foi possível ativar.");
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribePush();
      toast.success("Notificações desativadas");
      setPerm("default");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={enabled ? "outline" : "default"}
      size="sm"
      onClick={enabled ? disable : enable}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : enabled ? (
        <BellOff className="mr-2 h-4 w-4" />
      ) : (
        <Bell className="mr-2 h-4 w-4" />
      )}
      {enabled ? "Desativar notificações" : "Ativar notificações"}
    </Button>
  );
}
