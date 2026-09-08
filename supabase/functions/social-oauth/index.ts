import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { getAdapter } from "../_shared/platforms/registry.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const platform = String(body.platform || "");

    if (action === "auth_url") {
      const adapter = getAdapter(platform);
      const state = crypto.randomUUID();
      return json({ url: adapter.authUrl(String(body.redirect_uri || ""), state), state });
    }

    if (action === "connect") {
      const adapter = getAdapter(platform);
      let accounts;
      try {
        accounts = await adapter.exchangeCode(
          String(body.code || ""),
          String(body.redirect_uri || ""),
        );
      } catch (e) {
        console.error("social-oauth connect error", e);
        return json({ error: String((e as Error).message) }, 400);
      }
      if (!accounts.length) {
        return json({ error: "Nenhuma conta encontrada nesse login" }, 400);
      }


      const saved: string[] = [];
      for (const acc of accounts) {
        const { data: existing } = await admin
          .from("social_accounts")
          .select("id")
          .eq("platform", platform)
          .eq("external_id", acc.externalId)
          .maybeSingle();

        const payload = {
          platform,
          external_id: acc.externalId,
          username: acc.username,
          display_name: acc.displayName,
          profile_picture: acc.profilePicture,
          status: "connected",
          token_status: "ok",
          token_error: null,
          token_checked_at: new Date().toISOString(),
          expires_at: acc.expiresAt ?? null,
          last_synced_at: new Date().toISOString(),
          created_by: userId,
          client_id: body.client_id ?? null,
        };

        let accountId = existing?.id as string | undefined;
        if (accountId) {
          await admin.from("social_accounts").update(payload).eq("id", accountId);
        } else {
          const { data: inserted, error } = await admin
            .from("social_accounts").insert(payload).select("id").single();
          if (error) throw new Error(error.message);
          accountId = inserted.id;
        }

        await admin.from("social_account_secrets").upsert({
          account_id: accountId,
          access_token: acc.accessToken,
          refresh_token: acc.refreshToken ?? "",
          expires_at: acc.expiresAt ?? null,
          updated_at: new Date().toISOString(),
        });
        saved.push(acc.username);
      }

      return json({ success: true, accounts: saved });
    }

    if (action === "sync") {
      const accountId = String(body.account_id || "");
      const { data: acc } = await admin
        .from("social_accounts").select("*").eq("id", accountId).maybeSingle();
      if (!acc) return json({ error: "Conta não encontrada" }, 404);
      const { data: secret } = await admin
        .from("social_account_secrets").select("access_token, refresh_token")
        .eq("account_id", accountId).maybeSingle();

      try {
        const adapter = getAdapter(acc.platform);
        let accessToken = secret?.access_token || "";

        // Antes de marcar a conta como expirada, tenta renovar o token em
        // silêncio usando o token de usuário guardado (refresh_token) — assim
        // um page token revogado é trocado sem o cliente reconectar.
        if (adapter.refreshedToken && secret?.refresh_token) {
          try {
            const base = {
              id: acc.id,
              externalId: acc.external_id || "",
              username: acc.username,
              accessToken,
              refreshToken: secret.refresh_token || "",
            };
            // Testa se o token atual ainda serve
            await adapter.fetchProfile(base).catch(async (profileErr: any) => {
              const msg = String(profileErr?.message || profileErr);
              if (/Token de acesso|OAuthException|Permissão/i.test(msg)) {
                const fresh = await adapter.refreshedToken!(base, secret.refresh_token);
                accessToken = fresh.accessToken;
                await admin.from("social_account_secrets").update({
                  access_token: fresh.accessToken,
                  refresh_token: secret.refresh_token,
                  expires_at: fresh.expiresAt ?? secret.expires_at ?? null,
                  updated_at: new Date().toISOString(),
                }).eq("account_id", accountId);
              }
            });
          } catch (refreshErr) {
            console.warn(`sync: refresh falhou para @${acc.username}`, String((refreshErr as Error)?.message || refreshErr));
          }
        }

        const profile = await adapter.fetchProfile({
          id: acc.id,
          externalId: acc.external_id || "",
          username: acc.username,
          accessToken: accessToken,
          refreshToken: secret?.refresh_token || "",
        });
        await admin.from("social_accounts").update({
          username: profile.username,
          display_name: profile.displayName,
          profile_picture: profile.profilePicture,
          status: "connected",
          token_status: "ok",
          token_error: null,
          token_checked_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        }).eq("id", accountId);
        return json({ success: true, status: "connected" });
      } catch (e) {
        await admin.from("social_accounts").update({
          status: "expired",
          last_synced_at: new Date().toISOString(),
        }).eq("id", accountId);
        return json({
          success: false,
          status: "expired",
          details: "Token inválido e a renovação automática falhou. Refaca o login para reconectar.",
        });
      }
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("social-oauth error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
