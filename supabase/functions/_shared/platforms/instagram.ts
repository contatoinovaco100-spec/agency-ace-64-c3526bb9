import {
  AccountContext,
  jsonFetch,
  PlatformAdapter,
  ProfileInfo,
  PublishInput,
  PublishResult,
  sleep,
} from "./types.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const APP_ID = Deno.env.get("META_APP_ID") || "792310407276103";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

export const instagramAdapter: PlatformAdapter = {
  id: "instagram",

  authUrl(redirectUri, state) {
    const scope = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` +
      `&response_type=code&scope=${encodeURIComponent(scope)}`;
  },

  async exchangeCode(code, redirectUri) {
    if (!APP_SECRET) throw new Error("META_APP_SECRET não configurado");

    const short = await jsonFetch(
      `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
    );
    const long = await jsonFetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}` +
        `&client_secret=${APP_SECRET}&fb_exchange_token=${short.access_token}`,
    );
    const userToken: string = long.access_token;
    const expiresAt = long.expires_in
      ? new Date(Date.now() + Number(long.expires_in) * 1000).toISOString()
      : undefined;

    const pages = await jsonFetch(
      `${GRAPH}/me/accounts?fields=name,access_token,instagram_business_account{id,username,name,profile_picture_url}&limit=200&access_token=${userToken}`,
    );

    const accounts = [];
    for (const page of pages.data || []) {
      const ig = page.instagram_business_account;
      if (!ig) continue;
      accounts.push({
        externalId: ig.id,
        username: ig.username || "",
        displayName: ig.name || page.name || "",
        profilePicture: ig.profile_picture_url || "",
        accessToken: page.access_token || userToken,
        expiresAt,
      });
    }
    return accounts;
  },

  async fetchProfile(account): Promise<ProfileInfo> {
    const data = await jsonFetch(
      `${GRAPH}/${account.externalId}?fields=id,username,name,profile_picture_url&access_token=${account.accessToken}`,
    );
    return {
      externalId: data.id,
      username: data.username || account.username,
      displayName: data.name || "",
      profilePicture: data.profile_picture_url || "",
    };
  },

  async publish(account: AccountContext, input: PublishInput): Promise<PublishResult> {
    const params = new URLSearchParams();
    params.set("access_token", account.accessToken);
    params.set("caption", input.caption || "");
    if (input.mediaType === "video") {
      params.set("media_type", "REELS");
      params.set("video_url", input.mediaUrl);
      if (input.thumbnailUrl) params.set("thumb_offset", "0");
    } else {
      params.set("image_url", input.mediaUrl);
    }

    const container = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
      method: "POST",
      body: params,
    });

    // Aguarda o processamento do vídeo (até ~5 min)
    if (input.mediaType === "video") {
      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const st = await jsonFetch(
          `${GRAPH}/${container.id}?fields=status_code,status&access_token=${account.accessToken}`,
        );
        if (st.status_code === "FINISHED") break;
        if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
          throw new Error(`Falha no processamento do vídeo: ${st.status || st.status_code}`);
        }
        if (i === 59) throw new Error("Tempo esgotado no processamento do vídeo");
      }
    }

    const publishParams = new URLSearchParams();
    publishParams.set("creation_id", container.id);
    publishParams.set("access_token", account.accessToken);
    const published = await jsonFetch(`${GRAPH}/${account.externalId}/media_publish`, {
      method: "POST",
      body: publishParams,
    });

    if (input.firstComment) {
      try {
        const cp = new URLSearchParams();
        cp.set("message", input.firstComment);
        cp.set("access_token", account.accessToken);
        await jsonFetch(`${GRAPH}/${published.id}/comments`, { method: "POST", body: cp });
      } catch (_) {
        // primeiro comentário é opcional — não invalida a publicação
      }
    }

    let permalink = "";
    try {
      const info = await jsonFetch(
        `${GRAPH}/${published.id}?fields=permalink&access_token=${account.accessToken}`,
      );
      permalink = info.permalink || "";
    } catch (_) { /* ignore */ }

    return { remotePostId: published.id, permalink };
  },
};
