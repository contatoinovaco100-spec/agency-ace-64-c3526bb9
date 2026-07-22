import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extrai o maior número plausível de views/plays a partir do HTML público do Instagram.
// O IG muda o markup com frequência; tentamos várias chaves conhecidas e caímos em og:description.
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
  // fallback: og:description costuma vir "X likes, Y comments" ou "X views on ..."
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

// Converte "/p/CODE/" ou "/reel/CODE/" em URL de embed pública (não exige login e raramente é bloqueada)
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
  // "1.2M", "12,3 mil", "45K", "1 234"
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
  // Embed inclui "view_count":123 ou texto "1.2M views" / "1,2 mi visualizações"
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

async function scrapePost(url: string): Promise<{ views: number | null; error: string | null }> {
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
      const views = u.includes("/embed") ? extractFromEmbed(html) ?? extractViews(html) : extractViews(html);
      if (views !== null) return { views, error: null };
      lastErr = "views não encontradas";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "erro desconhecido";
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { views: null, error: lastErr };
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

    const results: Array<{ id: string; ok: boolean; views: number | null; error: string | null }> = [];

    for (const p of posts || []) {
      const { views, error: err } = await scrapePost(p.post_url);
      const prev = Number(p.views_count) || 0;

      if (views !== null) {
        await supabase
          .from("squad_viral_posts")
          .update({
            previous_views: prev,
            views_count: views,
            last_scraped_at: new Date().toISOString(),
            scrape_error: null,
          })
          .eq("id", p.id);
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
      // pequeno respiro entre requests pra não estressar o IG
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
