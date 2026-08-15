import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GRAPH = "https://graph.facebook.com/v21.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function g(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Erro ${res.status}`);
  return body;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claims, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { account_id, days } = await req.json().catch(() => ({}));
    if (!account_id || typeof account_id !== "string") {
      return json({ error: "account_id obrigatório" }, 400);
    }
    const range = Math.min(Math.max(Number(days) || 30, 7), 90);

    const { data: acc } = await admin
      .from("social_accounts").select("*").eq("id", account_id).maybeSingle();
    if (!acc) return json({ error: "Conta não encontrada" }, 404);
    if (acc.platform !== "instagram") return json({ error: "Só Instagram por enquanto" }, 400);

    const { data: secret } = await admin
      .from("social_account_secrets").select("access_token")
      .eq("account_id", account_id).maybeSingle();
    const token = secret?.access_token;
    if (!token) return json({ error: "Token indisponível — reconecte a conta" }, 400);

    const igId = acc.external_id;
    if (!igId) return json({ error: "Conta sem ID do Instagram Business" }, 400);

    const profile = await g(
      `${GRAPH}/${igId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
    );

    const until = Math.floor(Date.now() / 1000);
    const since = until - range * 86400;

    // A Graph API só aceita janelas de no máximo 30 dias por requisição.
    // Sem isso, períodos maiores retornam erro e a métrica vinha zerada.
    const windows: Array<[number, number]> = [];
    for (let end = until; end > since; end -= 30 * 86400) {
      const start = Math.max(since, end - 30 * 86400);
      windows.push([start, end]);
      if (windows.length > 4) break;
    }

    const fetchSeries = async (metric: string) => {
      const parts = await Promise.all(
        windows.map((w) =>
          safe(
            () =>
              g(
                `${GRAPH}/${igId}/insights?metric=${metric}&period=day&since=${w[0]}&until=${w[1]}&access_token=${token}`,
              ),
            { data: [] as any[] },
          )
        ),
      );
      return parts;
    };

    const [reachParts, profileViewsParts, followerParts, viewsParts] = await Promise.all([
      fetchSeries("reach"),
      fetchSeries("profile_views"),
      fetchSeries("follower_count"),
      fetchSeries("views"),
    ]);

    const byDate: Record<string, any> = {};
    // end_time de period=day representa o FIM do dia (07/08h UTC do dia seguinte),
    // então o dado pertence ao dia anterior.
    const dayOf = (endTime: string) => {
      const t = Date.parse(endTime);
      if (!Number.isFinite(t)) return "";
      return new Date(t - 12 * 3600 * 1000).toISOString().slice(0, 10);
    };
    const collect = (payload: any, as?: string) => {
      for (const metric of payload?.data || []) {
        for (const v of metric.values || []) {
          const date = dayOf(v.end_time || "");
          if (!date) continue;
          byDate[date] = byDate[date] || { date };
          const key = as || metric.name;
          const value = Number(v.value) || 0;
          // não sobrescreve valor real por 0 vindo de janelas sobrepostas
          if (byDate[date][key] == null || value > 0) byDate[date][key] = value;
        }
      }
    };
    reachParts.forEach((p) => collect(p, "reach"));
    profileViewsParts.forEach((p) => collect(p, "profile_views"));
    followerParts.forEach((p) => collect(p, "follower_count"));
    viewsParts.forEach((p) => collect(p, "views"));

    const daily = Object.values(byDate)
      .filter((d: any) => d.date >= new Date(since * 1000).toISOString().slice(0, 10))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));


    const mediaRes = await safe(
      () =>
        g(
          `${GRAPH}/${igId}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=24&access_token=${token}`,
        ),
      { data: [] as any[] },
    );

    const media = await Promise.all(
      (mediaRes.data || []).map(async (m: any) => {
        const isReel = m.media_product_type === "REELS";
        const metrics = isReel
          ? "reach,saved,shares,comments,likes,plays"
          : "reach,saved,shares";
        const ins = await safe(
          () => g(`${GRAPH}/${m.id}/insights?metric=${metrics}&access_token=${token}`),
          { data: [] as any[] },
        );
        const vals: Record<string, number> = {};
        for (const metric of ins.data || []) {
          vals[metric.name] = Number(metric.values?.[0]?.value) || 0;
        }
        const reach = vals.reach || 0;
        const engagement = (m.like_count || 0) + (m.comments_count || 0) +
          (vals.saved || 0) + (vals.shares || 0);
        return {
          id: m.id,
          caption: m.caption || "",
          media_type: m.media_type,
          is_reel: isReel,
          thumbnail: m.thumbnail_url || m.media_url || "",
          permalink: m.permalink || "",
          timestamp: m.timestamp,
          likes: m.like_count || 0,
          comments: m.comments_count || 0,
          saved: vals.saved || 0,
          shares: vals.shares || 0,
          plays: vals.plays || 0,
          reach,
          engagement,
          engagement_rate: reach ? Number(((engagement / reach) * 100).toFixed(2)) : 0,
        };
      }),
    );

    const avgReach = media.length
      ? Math.round(media.reduce((s, m) => s + m.reach, 0) / media.length)
      : 0;
    const viral = media
      .filter((m) => avgReach > 0 && m.reach >= avgReach * 2)
      .sort((a, b) => b.reach - a.reach);

    const totalReach = daily.reduce((s: number, d: any) => s + (d.reach || 0), 0);
    const totalProfileViews = daily.reduce((s: number, d: any) => s + (d.profile_views || 0), 0);
    const gainedFollowers = daily.reduce((s: number, d: any) => s + (d.follower_count || 0), 0);

    await admin.from("instagram_metrics_snapshots").upsert({
      account_id,
      snapshot_date: new Date().toISOString().slice(0, 10),
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      reach: totalReach,
      impressions: 0,
      profile_views: totalProfileViews,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id,snapshot_date" });

    const { data: history } = await admin
      .from("instagram_metrics_snapshots")
      .select("snapshot_date, followers, reach, profile_views")
      .eq("account_id", account_id)
      .order("snapshot_date", { ascending: true })
      .limit(120);

    return json({
      profile: {
        username: profile.username || acc.username,
        name: profile.name || "",
        picture: profile.profile_picture_url || acc.profile_picture || "",
        followers: profile.followers_count || 0,
        following: profile.follows_count || 0,
        media_count: profile.media_count || 0,
      },
      summary: {
        reach: totalReach,
        profile_views: totalProfileViews,
        gained_followers: gainedFollowers,
        avg_reach: avgReach,
        avg_engagement_rate: media.length
          ? Number((media.reduce((s, m) => s + m.engagement_rate, 0) / media.length).toFixed(2))
          : 0,
        days: range,
      },
      daily,
      media: media.sort((a, b) => b.reach - a.reach),
      viral,
      history: history || [],
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
