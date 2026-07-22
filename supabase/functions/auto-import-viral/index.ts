import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const globalToken = Deno.env.get("META_ACCESS_TOKEN");
    if (!globalToken) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN não configurado", success: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingPosts } = await supabase
      .from("squad_viral_posts" as any)
      .select("post_url");
    const existingUrls = new Set((existingPosts || []).map((p: any) => p.post_url));

    const { data: squads, error: sqErr } = await supabase.from("squads").select("id, name");
    console.log("Squads found:", squads?.length, sqErr?.message);

    const firstSquadId = squads?.[0]?.id;

    if (!firstSquadId) {
      return new Response(JSON.stringify({ error: "Nenhum squad cadastrado", debug: { squads: squads, error: sqErr } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${globalToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return new Response(JSON.stringify({ error: `Graph API: ${pagesData.error.message}`, success: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma página Facebook encontrada", success: false, pages: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imported: Array<{ url: string; views: number; squad: string }> = [];

    for (const page of pagesData.data) {
      const igId = page.instagram_business_account?.id;
      if (!igId) continue;

      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink&limit=10&access_token=${globalToken}`
      );
      const mediaData = await mediaRes.json();
      if (!mediaData.data) continue;

      for (const media of mediaData.data) {
        const postUrl = media.permalink || `https://www.instagram.com/p/${media.id}/`;
        if (existingUrls.has(postUrl)) continue;

        let views = 0;
        if (media.media_type === "VIDEO") {
          try {
            const insightsRes = await fetch(
              `https://graph.facebook.com/v21.0/${media.id}/insights?metric=plays&access_token=${globalToken}`
            );
            const insightsData = await insightsRes.json();
            const val = insightsData?.data?.[0]?.values?.[0]?.value;
            if (val !== undefined && val > 0) views = val;
          } catch (_) {}
        }

        const postedAt = media.timestamp ? new Date(media.timestamp).toISOString().split("T")[0] : null;

        const { error: insErr } = await supabase.from("squad_viral_posts" as any).insert({
          squad_id: firstSquadId,
          post_url: postUrl,
          caption: media.caption || null,
          views_count: views,
          like_count: media.like_count || 0,
          comment_count: media.comments_count || 0,
          media_type: media.media_type || "",
          thumbnail_url: media.thumbnail_url || media.media_url || null,
          posted_at: postedAt,
          auto_refresh: true,
        } as any);

        if (!insErr) {
          existingUrls.add(postUrl);
          imported.push({ url: postUrl, views, squad: squads?.find((s) => s.id === firstSquadId)?.name || "?" });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      imported: imported.length,
      posts: imported,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("auto-import error:", message);
    return new Response(JSON.stringify({ error: message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
