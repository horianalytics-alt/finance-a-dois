// Edge Function: send-push
// Acionada via trigger HTTP do Postgres (pg_net) sempre que uma transação é criada.
// Envia Web Push para todos os endpoints da família, EXCETO o autor da transação.
//
// Secrets necessários (já configurados):
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT (ex: mailto:voce@email.com)
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
//
// Esta função é PÚBLICA (verify_jwt=false) porque é chamada por um trigger
// do banco que não tem token de usuário. A segurança vem de:
//   1) só processa payloads vindos do próprio Postgres (mesma região)
//   2) usa service role pra ler push_subscriptions
//   3) só envia pra subscriptions da mesma family_id da transação

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TxPayload {
  id: string;
  family_id: string;
  profile_id: string;
  created_by_id: string;
  description: string;
  amount: number | string;
  type: "receita" | "despesa" | "investimento";
}

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
    const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.error("VAPID keys missing");
      return new Response(JSON.stringify({ ok: false, reason: "vapid_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx = (await req.json()) as TxPayload;
    if (!tx?.family_id || !tx?.created_by_id) {
      return new Response(JSON.stringify({ ok: false, reason: "bad_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const admin = createClient(SB_URL, SB_SERVICE);

    // Pega subscriptions da família, exceto do autor
    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, profile_id")
      .eq("family_id", tx.family_id)
      .neq("profile_id", tx.created_by_id);

    if (subErr) {
      console.error("Supabase select error", subErr);
      return new Response(JSON.stringify({ ok: false, reason: subErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pega o nome do autor pra colocar na notificação
    const { data: author } = await admin
      .from("profiles")
      .select("name")
      .eq("id", tx.created_by_id)
      .maybeSingle();

    const sign = tx.type === "receita" ? "+" : tx.type === "despesa" ? "-" : "•";
    const valueStr = formatBRL(Number(tx.amount));
    const title = `${author?.name ?? "Parceiro(a)"} adicionou`;
    const body = `${tx.description} ${sign}${valueStr}`;
    const payload = JSON.stringify({
      title,
      body,
      url: "/dashboard",
    });

    const results = await Promise.allSettled(
      (subs ?? []).map(async (s) => {
        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await webpush.sendNotification(subscription, payload, { TTL: 60 });
          return { id: s.id, ok: true };
        } catch (err) {
          // Limpa subs expiradas (404/410)
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
          console.warn("push fail", s.endpoint, status);
          return { id: s.id, ok: false, status };
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, total: subs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(
      JSON.stringify({ ok: false, reason: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
