// Helpers para Web Push (registro de Service Worker + assinatura).
// As notificações reais SÓ disparam quando o app está publicado em HTTPS
// (não funciona dentro do iframe do preview do Lovable).
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return window.btoa(s);
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Registra o SW (uma vez). Não funciona dentro de iframes do preview. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  // Não tenta registrar em iframe (preview do Lovable)
  try {
    if (window.self !== window.top) return null;
  } catch {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (e) {
    console.warn("[push] SW register failed:", e);
    return null;
  }
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

export async function requestAndSubscribe(params: {
  profileId: string;
  familyId: string;
  userId: string;
  vapidPublicKey: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Navegador sem suporte a Push." };
  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "Service Worker indisponível (preview/iframe)." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permissão negada." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(params.vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Buffer.from converte para ArrayBuffer "pleno" (evita warning de SharedArrayBuffer)
      applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = bufferToBase64(sub.getKey("p256dh"));
  const auth = bufferToBase64(sub.getKey("auth"));

  // upsert por endpoint único
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: params.profileId,
      family_id: params.familyId,
      user_id: params.userId,
      endpoint,
      p256dh: json.keys?.p256dh ?? p256dh,
      auth: json.keys?.auth ?? auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
