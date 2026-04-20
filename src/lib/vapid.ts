// Chave pública VAPID. Pode ser exposta no client (é "publishable").
// Lê de import.meta.env.VITE_VAPID_PUBLIC_KEY se existir; caso contrário,
// cai no valor gerado e fixo abaixo (que JÁ está pareado com a privada
// configurada no secret VAPID_PRIVATE_KEY do edge function send-push).
const HARDCODED_FALLBACK =
  "BCs8lMX9-_0OCMEZD45CpoH6EtV6OXZ8OXVVg8zKPIZhv7jC0H_0_4IW5SvNxBhhCdfj03zlihnF2EZtXo5_7JQ";

const fromEnv =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_VAPID_PUBLIC_KEY) ||
  "";

export const VAPID_PUBLIC_KEY: string = fromEnv || HARDCODED_FALLBACK;

export const HAS_VAPID_KEY = !!VAPID_PUBLIC_KEY;
