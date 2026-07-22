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
    const tokens: string[] = [];
    if (globalToken) tokens.push(globalToken);

    const { data: accounts } = await supabase
      .from("client_meta_accounts")
      .select("access_token, instagram_account_id, client_id, account_name");

    if (accounts) {
      for (const a of accounts) {
        if (a.access_token && !tokens.includes(a.access_token)) {
          tokens.push(a.access_token);
        }
      }
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum token disponível" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: squads } = await supabase.from("squads").select("id, name");
    const { data: squadClients } = await supabase.from("squad_clients").select("squad_id, client_id");
    const { data: existingPosts } = await supabase.from("squad_viral_posts" as any).select("post_url");

    const existingUrls = new Set((existingPosts || []).map((p: any) => p.post_url));

    const clientSquadMap = new Map<string, string>();
    if (squadClients) {
      for (const sc of squadClients) {
        clientSquadMap.set(sc.client_id, sc.squad_id);
      }
    }

    const firstSquadId = squads?.[0]?.id;

    const imported: Array<{ url: string; views: number; squad: string }> = [];

    const igAccountIds = new Set<string>();
    if (accounts) {
      for (const a of accounts) {
        if (a.instagram_account_id) igAccountIds.add(a.instagram_account_id);
      }
    }

    for (const token of tokens) {
      try {
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,name,username}&access_token=${token}`
        );
        const meData = await meRes.json();
        if (!meData.data) continue;

        for (const page of meData.data) {
          const igId = page.instagram_business_account?.id;
          if (!igId) continue;

          const mediaRes = await fetch(
            `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink&limit=25&access_token=${token}`
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
                  `https://graph.facebook.com/v21.0/${media.id}/insights?metric=plays,video_views&access_token=${token}`
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
              } catch (_) {}
            }

            let squadId = firstSquadId;
            const clientMeta = accounts?.find((a: any) => a.instagram_account_id === igId);
            if (clientMeta?.client_id) {
              const mapped = clientSquadMap.get(clientMeta.client_id);
              if (mapped) squadId = mapped;
            }

            if (!squadId) continue;

            const postedAt = media.timestamp ? new Date(media.timestamp).toISOString().split("T")[0] : null;

            const { error: insErr } = await supabase.from("squad_viral_posts" as any).insert({
              squad_id: squadId,
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
              imported.push({ url: postUrl, views, squad: squads?.find((s) => s.id === squadId)?.name || "?" });
            }

            await new Promise((r) => setTimeout(r, 300));
          }
        }
      } catch (e) {
        console.error("Erro ao buscar mídias:", e);
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
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
