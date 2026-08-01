import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
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
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

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
      const accounts = await adapter.exchangeCode(
        String(body.code || ""),
        String(body.redirect_uri || ""),
      );
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
        const profile = await adapter.fetchProfile({
          id: acc.id,
          externalId: acc.external_id || "",
          username: acc.username,
          accessToken: secret?.access_token || "",
          refreshToken: secret?.refresh_token || "",
        });
        await admin.from("social_accounts").update({
          username: profile.username,
          display_name: profile.displayName,
          profile_picture: profile.profilePicture,
          status: "connected",
          last_synced_at: new Date().toISOString(),
        }).eq("id", accountId);
        return json({ success: true, status: "connected" });
      } catch (e) {
        await admin.from("social_accounts").update({
          status: "expired",
          last_synced_at: new Date().toISOString(),
        }).eq("id", accountId);
        return json({ success: false, status: "expired", details: String((e as Error).message) });
      }
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("social-oauth error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
