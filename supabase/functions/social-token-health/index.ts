import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: accounts } = await admin
      .from("social_accounts")
      .select("id, username, external_id, platform")
      .eq("platform", "instagram");

    const globalToken = Deno.env.get("META_ACCESS_TOKEN") || "";
    const results: Array<{ username: string; status: string; error: string }> = [];

    const check = async (acc: any) => {
      let status = "ok";
      let error = "";
      try {
        const { data: secret } = await admin
          .from("social_account_secrets")
          .select("access_token")
          .eq("account_id", acc.id)
          .maybeSingle();

        const token = secret?.access_token || globalToken;
        if (!token) {
          status = "missing_token";
          error = "Sem token salvo";
        } else if (!acc.external_id) {
          status = "error";
          error = "Conta sem ID do Instagram";
        } else {
          const res = await fetch(
            `${GRAPH}/${acc.external_id}?fields=id,username&access_token=${encodeURIComponent(token)}`,
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body?.error) {
            const err = body?.error || {};
            const code = Number(err.code);
            status = code === 190 || code === 102 ? "expired" : "error";
            error = String(err.message || `HTTP ${res.status}`).slice(0, 300);
          }
        }
      } catch (e) {
        status = "error";
        error = String((e as Error).message).slice(0, 300);
      }

      await admin
        .from("social_accounts")
        .update({
          status: status === "ok" ? "connected" : status,
          token_status: status,
          token_error: error,
          token_checked_at: new Date().toISOString(),
        })
        .eq("id", acc.id);

      results.push({ username: acc.username, status, error });
    };

    const CONCURRENCY = 6;
    const list = accounts || [];
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      await Promise.allSettled(list.slice(i, i + CONCURRENCY).map(check));
    }

    const ok = results.filter((r) => r.status === "ok").length;
    return json({
      success: true,
      total: results.length,
      ok,
      broken: results.length - ok,
      results: results.sort((a, b) => a.status.localeCompare(b.status)),
    });
  } catch (e) {
    console.error("social-token-health error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
