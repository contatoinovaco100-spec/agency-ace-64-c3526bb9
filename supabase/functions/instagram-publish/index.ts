import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_APP_ID = "792310407276103";
const GRAPH = "https://graph.facebook.com/v21.0";

const SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "business_management",
].join(",");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function graph(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}${path}${method === "GET" ? `?${qs}` : ""}`, {
    method,
    ...(method === "POST"
      ? { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs }
      : {}),
  });
  const data = await res.json();
  if (data?.error) throw new Error(data.error.error_user_msg || data.error.message || "Erro na Graph API");
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Aguarda o container de vídeo/reels terminar de processar */
async function waitContainer(containerId: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const st = await graph(`/${containerId}`, { fields: "status_code,status", access_token: token });
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
      throw new Error(`Falha ao processar mídia: ${st.status || st.status_code}`);
    }
    await sleep(5000);
  }
  throw new Error("Tempo esgotado processando o vídeo");
}

async function publishToAccount(
  igId: string,
  token: string,
  caption: string,
  mediaType: string,
  mediaUrls: string[],
) {
  let creationId: string;

  if (mediaType === "CAROUSEL") {
    const children: string[] = [];
    for (const url of mediaUrls) {
      const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(url);
      const child = await graph(
        "/" + igId + "/media",
        {
          ...(isVideo ? { media_type: "VIDEO", video_url: url } : { image_url: url }),
          is_carousel_item: "true",
          access_token: token,
        },
        "POST",
      );
      if (isVideo) await waitContainer(child.id, token);
      children.push(child.id);
    }
    const container = await graph(
      `/${igId}/media`,
      { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token },
      "POST",
    );
    creationId = container.id;
  } else if (mediaType === "REELS") {
    const container = await graph(
      `/${igId}/media`,
      { media_type: "REELS", video_url: mediaUrls[0], caption, access_token: token },
      "POST",
    );
    await waitContainer(container.id, token);
    creationId = container.id;
  } else {
    const container = await graph(
      `/${igId}/media`,
      { image_url: mediaUrls[0], caption, access_token: token },
      "POST",
    );
    creationId = container.id;
  }

  const published = await graph(
    `/${igId}/media_publish`,
    { creation_id: creationId, access_token: token },
    "POST",
  );

  let permalink = "";
  try {
    const info = await graph(`/${published.id}`, { fields: "permalink", access_token: token });
    permalink = info.permalink || "";
  } catch (_) { /* opcional */ }

  return { mediaId: published.id, permalink };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body.action as string;

    // ---------- URL de login do Facebook ----------
    if (action === "auth_url") {
      const redirectUri = body.redirect_uri as string;
      const url =
        `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(SCOPES)}&response_type=code`;
      return json({ url });
    }

    // ---------- Trocar code por token e importar contas ----------
    if (action === "connect") {
      const appSecret = Deno.env.get("META_APP_SECRET")!;
      const tokenRes = await graph("/oauth/access_token", {
        client_id: META_APP_ID,
        client_secret: appSecret,
        redirect_uri: body.redirect_uri,
        code: body.code,
      });

      const longRes = await graph("/oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: appSecret,
        fb_exchange_token: tokenRes.access_token,
      });
      const userToken = longRes.access_token as string;

      const pages = await graph("/me/accounts", {
        fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
        limit: "100",
        access_token: userToken,
      });

      const connected: string[] = [];
      for (const page of pages.data || []) {
        const ig = page.instagram_business_account;
        if (!ig?.id) continue;
        const { error } = await admin.from("ig_accounts").upsert({
          ig_user_id: ig.id,
          username: ig.username || "",
          page_id: page.id,
          page_name: page.name || "",
          profile_picture_url: ig.profile_picture_url || "",
          access_token: page.access_token || userToken,
          active: true,
        }, { onConflict: "ig_user_id" });
        if (!error) connected.push(ig.username || ig.id);
      }

      return json({ success: true, connected, count: connected.length });
    }

    // ---------- Publicar em várias contas ----------
    if (action === "publish") {
      const accountIds: string[] = body.account_ids || [];
      const caption: string = body.caption || "";
      const mediaType: string = body.media_type || "IMAGE";
      const mediaUrls: string[] = body.media_urls || [];

      if (!accountIds.length) return json({ error: "Selecione ao menos uma conta" }, 400);
      if (!mediaUrls.length) return json({ error: "Envie ao menos uma mídia" }, 400);

      const { data: accounts } = await admin
        .from("ig_accounts")
        .select("*")
        .in("id", accountIds);

      const results: any[] = [];
      for (const acc of accounts || []) {
        try {
          const r = await publishToAccount(acc.ig_user_id, acc.access_token, caption, mediaType, mediaUrls);
          results.push({ account: acc.username, ok: true, ...r });
        } catch (e) {
          results.push({ account: acc.username, ok: false, error: e instanceof Error ? e.message : "erro" });
        }
      }

      const success = results.filter((r) => r.ok).length;
      await admin.from("ig_publications").insert({
        caption,
        media_type: mediaType,
        media_urls: mediaUrls,
        results,
        success_count: success,
        fail_count: results.length - success,
        created_by: user.id,
      });

      return json({ success: true, results });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro inesperado";
    console.error("instagram-publish:", message);
    return json({ error: message }, 500);
  }
});
