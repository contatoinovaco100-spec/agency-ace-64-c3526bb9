import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_APP_ID = "792310407276103";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, client_id, access_token, instagram_account_id, facebook_page_id, account_name } = await req.json();

    // Save/update meta account for a client
    if (action === "save_account") {
      const { error } = await supabase.from("client_meta_accounts").upsert({
        client_id,
        access_token,
        instagram_account_id: instagram_account_id || "",
        facebook_page_id: facebook_page_id || "",
        account_name: account_name || "",
      }, { onConflict: "client_id" });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange short-lived token for long-lived token
    if (action === "exchange_token") {
      const appSecret = Deno.env.get("META_APP_SECRET")!;
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${appSecret}&fb_exchange_token=${access_token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return new Response(JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pages & Instagram accounts for token
    if (action === "get_accounts") {
      // Get meta account token from DB
      const { data: metaAccount } = await supabase
        .from("client_meta_accounts")
        .select("access_token")
        .eq("client_id", client_id)
        .single();

      const globalToken = Deno.env.get("META_ACCESS_TOKEN");
      const token = access_token || metaAccount?.access_token || globalToken;
      if (!token) throw new Error("No access token available. Please configure META_ACCESS_TOKEN secret or provide a token.");

      // Get Facebook pages
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,name,username}&access_token=${token}`);
      const pagesData = await pagesRes.json();
      if (pagesData.error) throw new Error(pagesData.error.message);

      return new Response(JSON.stringify({ pages: pagesData.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Instagram insights
    if (action === "get_insights") {
      const { data: metaAccount } = await supabase
        .from("client_meta_accounts")
        .select("*")
        .eq("client_id", client_id)
        .single();

      const globalToken = Deno.env.get("META_ACCESS_TOKEN");
      const token = metaAccount?.access_token || globalToken;
      const igId = metaAccount?.instagram_account_id;

      if (!token || !igId) {
        return new Response(JSON.stringify({ error: "Meta account not configured for this client" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch profile info
      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}?fields=name,username,profile_picture_url,followers_count,media_count,follows_count&access_token=${token}`
      );
      const profile = await profileRes.json();
      if (profile.error) throw new Error(profile.error.message);

      // Fetch insights (last 30 days)
      const insightsMetrics = "reach,impressions,accounts_engaged,profile_views";
      const insightsRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=${insightsMetrics}&period=day&since=${Math.floor(Date.now() / 1000) - 30 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`
      );
      const insights = await insightsRes.json();

      // Fetch recent media
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${token}`
      );
      const media = await mediaRes.json();

      return new Response(JSON.stringify({
        profile,
        insights: insights.data || [],
        media: media.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Meta insights error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
