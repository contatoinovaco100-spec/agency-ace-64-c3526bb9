import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractViews(html: string): number | null {
  const patterns: RegExp[] = [
    /"video_view_count"\s*:\s*(\d+)/i,
    /"play_count"\s*:\s*(\d+)/i,
    /"video_play_count"\s*:\s*(\d+)/i,
    /"viewCount"\s*:\s*(\d+)/i,
    /"ig_play_count"\s*:\s*(\d+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0) return n;
    }
  }
  const og = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (og) {
    const viewsMatch = og[1].match(/([\d.,]+)\s*(views|visualizaç)/i);
    if (viewsMatch) {
      const raw = viewsMatch[1].replace(/[.,]/g, "");
      const n = Number(raw);
      if (n > 0) return n;
    }
  }
  return null;
}

function toEmbedUrls(url: string): string[] {
  const m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return [url];
  const code = m[1];
  return [
    `https://www.instagram.com/p/${code}/embed/captioned/`,
    `https://www.instagram.com/reel/${code}/embed/captioned/`,
    `https://www.instagram.com/p/${code}/embed/`,
    url,
  ];
}

function parseCompact(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^([\d.,]+)\s*(k|m|mil|mi|b)?/i);
  if (!m) return null;
  const num = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (!isFinite(num)) return null;
  const suf = (m[2] || "").toLowerCase();
  const mult = suf === "k" || suf === "mil" ? 1_000 : suf === "m" || suf === "mi" ? 1_000_000 : suf === "b" ? 1_000_000_000 : 1;
  return Math.round(num * mult);
}

function extractFromEmbed(html: string): number | null {
  const jsonKeys = [/"view_count"\s*:\s*(\d+)/i, /"play_count"\s*:\s*(\d+)/i, /"video_view_count"\s*:\s*(\d+)/i];
  for (const re of jsonKeys) {
    const m = html.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0) return n;
    }
  }
  const textPatterns = [
    /([\d.,]+\s*(?:k|m|mil|mi|b)?)\s*(?:views|visualizaç[õo]es|plays|reproduç[õo]es)/i,
  ];
  for (const re of textPatterns) {
    const m = html.match(re);
    if (m) {
      const n = parseCompact(m[1]);
      if (n && n > 0) return n;
    }
  }
  return null;
}

function extractMediaId(html: string): string | null {
  const m1 = html.match(/instagram:\/\/media\?id=(\d+)/i);
  if (m1) return m1[1];
  const m2 = html.match(/"media_id"\s*:\s*"?(\d+)"?/i);
  if (m2) return m2[1];
  return null;
}

interface GraphData {
  views: number | null;
  like_count: number;
  comment_count: number;
  media_type: string;
  thumbnail_url: string | null;
}

async function fetchGraphStats(mediaId: string, tokens: string[]): Promise<GraphData | null> {
  for (const token of tokens) {
    try {
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${mediaId}?fields=like_count,comments_count,media_type,media_url,thumbnail_url,permalink&access_token=${token}`
      );
      if (!mediaRes.ok) continue;
      const mediaData = await mediaRes.json();
      if (mediaData.error) continue;

      let views: number | null = null;

      if (mediaData.media_type === "VIDEO") {
        const insightsRes = await fetch(
          `https://graph.facebook.com/v21.0/${mediaId}/insights?metric=plays,video_views&access_token=${token}`
        );
        const insightsData = await insightsRes.json();

        if (insightsData?.data) {
          for (const metric of insightsData.data) {
            const val = metric?.values?.[0]?.value;
            if (val !== undefined && val > 0) {
              views = val;
              break;
            }
          }
        }
      } else {
        views = null;
      }

      return {
        views,
        like_count: mediaData.like_count || 0,
        comment_count: mediaData.comments_count || 0,
        media_type: mediaData.media_type || "",
        thumbnail_url: mediaData.thumbnail_url || mediaData.media_url || null,
      };
    } catch (e) {
      console.error(`Erro ao consultar Graph API para mediaId ${mediaId}:`, e);
    }
  }
  return null;
}

async function scrapePost(
  url: string,
  tokens: string[]
): Promise<{ views: number | null; error: string | null; graphData: GraphData | null }> {
  const candidates = toEmbedUrls(url);
  let lastErr = "sem tentativas";
  for (const u of candidates) {
    try {
      const res = await fetch(u, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
        },
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status} em ${u.includes("/embed") ? "embed" : "post"}`;
        continue;
      }
      const html = await res.text();

      if (tokens.length > 0) {
        const mediaId = extractMediaId(html);
        if (mediaId) {
          const graphData = await fetchGraphStats(mediaId, tokens);
          if (graphData) {
            return {
              views: graphData.views,
              error: null,
              graphData,
            };
          }
        }
      }

      const views = u.includes("/embed") ? extractFromEmbed(html) ?? extractViews(html) : extractViews(html);
      if (views !== null) return { views, error: null, graphData: null };
      lastErr = "views não encontradas";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "erro desconhecido";
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { views: null, error: lastErr, graphData: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let onlyId: string | null = null;
    try {
      const body = await req.json();
      if (body?.post_id) onlyId = String(body.post_id);
    } catch (_) {}

    let query = supabase
      .from("squad_viral_posts")
      .select("id, post_url, views_count")
      .eq("auto_refresh", true);
    if (onlyId) query = query.eq("id", onlyId);

    const { data: posts, error } = await query;
    if (error) throw error;

    const globalToken = Deno.env.get("META_ACCESS_TOKEN");
    const tokens: string[] = [];
    if (globalToken) tokens.push(globalToken);

    try {
      const { data: accounts } = await supabase
        .from("client_meta_accounts")
        .select("access_token");
      if (accounts) {
        for (const a of accounts) {
          if (a.access_token && !tokens.includes(a.access_token)) {
            tokens.push(a.access_token);
          }
        }
      }
    } catch (dbErr) {
      console.error("Erro ao carregar tokens do banco:", dbErr);
    }

    const results: Array<{
      id: string;
      ok: boolean;
      views: number | null;
      error: string | null;
    }> = [];

    for (const p of posts || []) {
      const { views, error: err, graphData } = await scrapePost(p.post_url, tokens);
      const prev = Number(p.views_count) || 0;

      if (views !== null) {
        const update: Record<string, unknown> = {
          previous_views: prev,
          views_count: views,
          last_scraped_at: new Date().toISOString(),
          scrape_error: null,
        };
        if (graphData) {
          if (graphData.like_count > 0) update.like_count = graphData.like_count;
          if (graphData.comment_count > 0) update.comment_count = graphData.comment_count;
          if (graphData.media_type) update.media_type = graphData.media_type;
          if (graphData.thumbnail_url) update.thumbnail_url = graphData.thumbnail_url;
        }
        await supabase.from("squad_viral_posts").update(update).eq("id", p.id);
      } else {
        await supabase
          .from("squad_viral_posts")
          .update({
            last_scraped_at: new Date().toISOString(),
            scrape_error: err,
          })
          .eq("id", p.id);
      }

      results.push({ id: p.id, ok: views !== null, views, error: err });
      await new Promise((r) => setTimeout(r, 400));
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("scrape-viral-views error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
