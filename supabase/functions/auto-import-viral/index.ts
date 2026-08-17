import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v22.0";

async function fetchViews(mediaId: string, token: string): Promise<number> {
  for (const metric of ["views", "reach"]) {
    try {
      const res = await fetch(`${GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${token}`);
      const data = await res.json();
      const val = data?.data?.[0]?.values?.[0]?.value;
      if (typeof val === "number" && val > 0) return val;
    } catch (_) { /* próxima métrica */ }
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));

    // Janela: último mês (padrão 30 dias)
    const days = Number(body?.days) > 0 ? Number(body.days) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Mínimo de views (padrão 20.000, ou o configurado em viral_settings)
    let minViews = Number(body?.min_views) > 0 ? Number(body.min_views) : 0;
    if (!minViews) {
      const { data: settings } = await supabase
        .from("viral_settings" as any)
        .select("min_views")
        .limit(1)
        .maybeSingle();
      minViews = Number((settings as any)?.min_views) || 20000;
    }

    // Squads e mapeamento cliente -> squad
    const { data: squads } = await supabase.from("squads").select("id, name");
    if (!squads || squads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum squad cadastrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: squadClients } = await supabase.from("squad_clients").select("squad_id, client_id");
    const clientToSquad = new Map<string, string>();
    for (const sc of squadClients || []) {
      if (sc.client_id && sc.squad_id) clientToSquad.set(sc.client_id, sc.squad_id);
    }
    const fallbackSquad = squads[0].id;

    // Contas de Instagram conectadas pelo app da Meta
    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("id, external_id, username, client_id, platform, status")
      .eq("platform", "instagram");

    const active = (accounts || []).filter((a: any) => a.external_id && a.status !== "revoked");
    if (active.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhuma conta do Instagram conectada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: secrets } = await supabase
      .from("social_account_secrets" as any)
      .select("account_id, access_token");
    const tokenByAccount = new Map<string, string>();
    for (const s of (secrets as any[]) || []) {
      if (s.access_token) tokenByAccount.set(s.account_id, s.access_token);
    }
    const globalToken = Deno.env.get("META_ACCESS_TOKEN") || "";

    const { data: existingPosts } = await supabase
      .from("squad_viral_posts" as any)
      .select("id, post_url, views_count");
    const existing = new Map<string, { id: string; views_count: number }>();
    for (const p of (existingPosts as any[]) || []) {
      existing.set(p.post_url, { id: p.id, views_count: p.views_count || 0 });
    }

    const imported: Array<{ url: string; views: number; account: string }> = [];
    const updated: string[] = [];
    let scanned = 0;

    for (const acc of active as any[]) {
      const token = tokenByAccount.get(acc.id) || globalToken;
      if (!token) continue;
      const squadId = (acc.client_id && clientToSquad.get(acc.client_id)) || fallbackSquad;

      let url =
        `${GRAPH}/${acc.external_id}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink&limit=50&access_token=${token}`;

      let stop = false;
      for (let page = 0; page < 4 && url && !stop; page++) {
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || data?.error || !data?.data) break;

        for (const media of data.data) {
          const ts = media.timestamp ? new Date(media.timestamp) : null;
          if (ts && ts < since) { stop = true; break; }
          scanned++;

          const isVideo = media.media_type === "VIDEO" || media.media_product_type === "REELS";
          if (!isVideo) continue;

          const views = await fetchViews(media.id, token);
          if (views < minViews) continue;

          const postUrl = media.permalink || `https://www.instagram.com/p/${media.id}/`;
          const already = existing.get(postUrl);

          if (already) {
            if (views > (already.views_count || 0)) {
              await supabase
                .from("squad_viral_posts" as any)
                .update({
                  previous_views: already.views_count || 0,
                  views_count: views,
                  last_scraped_at: new Date().toISOString(),
                } as any)
                .eq("id", already.id);
              updated.push(postUrl);
            }
            continue;
          }

          const { error: insErr } = await supabase.from("squad_viral_posts" as any).insert({
            squad_id: squadId,
            post_url: postUrl,
            caption: media.caption || null,
            views_count: views,
            thumbnail_url: media.thumbnail_url || media.media_url || null,
            posted_at: ts ? ts.toISOString().split("T")[0] : null,
            auto_refresh: true,
            last_scraped_at: new Date().toISOString(),
          } as any);

          if (!insErr) {
            existing.set(postUrl, { id: "", views_count: views });
            imported.push({ url: postUrl, views, account: acc.username || acc.external_id });
          } else {
            console.error("insert error:", insErr.message);
          }
        }
        url = data?.paging?.next || "";
      }
    }

    console.log(
      `auto-import-viral: contas=${active.length} midias=${scanned} min=${minViews} novos=${imported.length} atualizados=${updated.length}`,
    );

    return new Response(JSON.stringify({
      success: true,
      imported: imported.length,
      updated: updated.length,
      min_views: minViews,
      days,
      accounts: active.length,
      posts: imported,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("auto-import error:", message);
    return new Response(JSON.stringify({ error: message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
