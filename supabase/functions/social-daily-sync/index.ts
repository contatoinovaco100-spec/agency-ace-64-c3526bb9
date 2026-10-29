// Sincronização diária das Redes Sociais (cron às 00:00 de Brasília).
// Com o token de usuário do Facebook guardado em cada login, renova o acesso, puxa as Páginas/Instagrams
// que a INOVA enxerga, adiciona as contas novas e renova o token das existentes.
// Cada execução fica em `social_sync_runs`; quando dá erro, o Dashboard avisa os admins.
import { createClient } from "npm:@supabase/supabase-js@2";
import { saveConnectedAccounts, type ConnectedAccount } from "../_shared/save-social-accounts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GRAPH = "https://graph.facebook.com/v22.0";
const APP_ID = Deno.env.get("META_APP_ID") || "2235928767163276";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
/** Evita rodar duas vezes seguidas (a função é pública para o cron conseguir chamar) */
const MIN_INTERVAL_MS = 10 * 60 * 1000;

async function graph(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    const err = body?.error || {};
    const e = new Error(String(err.message || `HTTP ${res.status}`));
    (e as Error & { code?: number }).code = Number(err.code);
    throw e;
  }
  return body;
}

/** Lista os Instagrams visíveis para um token de usuário, já com o token renovado */
async function discover(userToken: string): Promise<ConnectedAccount[]> {
  let renewed = userToken;
  let expiresAt: string | undefined;
  if (APP_SECRET) {
    try {
      const long = await graph(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}` +
          `&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(userToken)}`,
      );
      if (long.access_token) renewed = long.access_token;
      if (long.expires_in) expiresAt = new Date(Date.now() + Number(long.expires_in) * 1000).toISOString();
    } catch {
      // Segue com o token atual; se ele também tiver vencido, a listagem abaixo acusa
    }
  }
  const pages = await graph(
    `${GRAPH}/me/accounts?fields=name,access_token,instagram_business_account{id,username,name,profile_picture_url}` +
      `&limit=200&access_token=${encodeURIComponent(renewed)}`,
  );
  const out: ConnectedAccount[] = [];
  for (const page of pages.data || []) {
    const ig = page.instagram_business_account;
    if (!ig) continue;
    out.push({
      externalId: String(ig.id),
      username: ig.username || "",
      displayName: ig.name || page.name || "",
      profilePicture: ig.profile_picture_url || "",
      accessToken: page.access_token || renewed,
      refreshToken: renewed,
      expiresAt,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const log = async (row: Record<string, unknown>) => {
    await admin.from("social_sync_runs").insert(row);
    return json(row, row.status === "error" ? 500 : 200);
  };

  try {
    const { data: last } = await admin.from("social_sync_runs")
      .select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < MIN_INTERVAL_MS) {
      return json({ skipped: true, reason: "Sincronização rodou há menos de 10 minutos" });
    }

    // Tokens de usuário guardados nos logins (um por pessoa que conectou contas)
    const { data: secrets } = await admin.from("social_account_secrets")
      .select("refresh_token").not("refresh_token", "is", null);
    const tokens = [...new Set((secrets ?? []).map((s) => String(s.refresh_token)).filter(Boolean))];
    if (!tokens.length) {
      return await log({
        status: "error",
        message: "Nenhum login do Facebook salvo. Conecte uma conta em Redes Sociais para a atualização funcionar.",
      });
    }

    const found = new Map<string, ConnectedAccount>();
    const tokenErrors: string[] = [];
    let expired = 0;
    for (const token of tokens) {
      try {
        for (const acc of await discover(token)) if (!found.has(acc.externalId)) found.set(acc.externalId, acc);
      } catch (e) {
        const code = (e as Error & { code?: number }).code;
        if (code === 190 || code === 102) expired++;
        tokenErrors.push(String((e as Error).message).slice(0, 200));
      }
    }

    // Todos os logins falharam: nada foi atualizado
    if (!found.size && tokenErrors.length) {
      return await log({
        status: "error",
        message: expired
          ? "O acesso do Facebook da INOVA venceu. Refaça o login em Redes Sociais (botão Conectar Instagram)."
          : `A Meta recusou a atualização: ${tokenErrors[0]}`,
        details: { token_errors: tokenErrors },
      });
    }

    const { data: existing } = await admin.from("social_accounts")
      .select("external_id, username").eq("platform", "instagram");
    const known = new Set((existing ?? []).map((a) => String(a.external_id)));
    const added = [...found.values()].filter((a) => !known.has(a.externalId));

    // Grava tudo: contas novas entram sem cliente; as existentes só renovam token (o vínculo com o cliente é mantido)
    await saveConnectedAccounts(admin, "instagram", [...found.values()], { createdBy: null, clientId: null });

    // Contas que estavam conectadas e não apareceram para nenhum login (acesso removido na Meta)
    const missing = (existing ?? [])
      .filter((a) => a.external_id && !found.has(String(a.external_id)))
      .map((a) => a.username);

    return await log({
      status: tokenErrors.length || missing.length ? "warning" : "ok",
      message: [
        `${found.size} contas atualizadas`,
        added.length ? `${added.length} novas: ${added.map((a) => "@" + a.username).join(", ")}` : null,
        missing.length ? `${missing.length} sem acesso: ${missing.map((u) => "@" + u).join(", ")}` : null,
        tokenErrors.length ? `${tokenErrors.length} login(s) do Facebook com erro` : null,
      ].filter(Boolean).join(" · "),
      added: added.length,
      updated: found.size,
      details: { added: added.map((a) => a.username), missing, token_errors: tokenErrors },
    });
  } catch (e) {
    console.error("social-daily-sync error", e);
    return await log({ status: "error", message: `Erro inesperado na atualização: ${String((e as Error).message).slice(0, 300)}` });
  }
});
