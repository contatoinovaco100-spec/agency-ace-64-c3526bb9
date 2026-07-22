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

async function scrapePost(url: string): Promise<{ views: number | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { views: null, error: `HTTP ${res.status}` };
    const html = await res.text();
    const views = extractViews(html);
    if (views === null) return { views: null, error: "views não encontradas no HTML" };
    return { views, error: null };
  } catch (e) {
    return { views: null, error: e instanceof Error ? e.message : "erro desconhecido" };
  }
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
