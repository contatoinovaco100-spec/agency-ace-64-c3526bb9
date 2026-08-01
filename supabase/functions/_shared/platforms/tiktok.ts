import {
  AccountContext,
  jsonFetch,
  PlatformAdapter,
  ProfileInfo,
  PublishInput,
  PublishResult,
  sleep,
} from "./types.ts";

const API = "https://open.tiktokapis.com/v2";
const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") || "";
const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") || "";

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",

  authUrl(redirectUri, state) {
    const scope = "user.info.basic,video.publish,video.upload";
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}` +
      `&scope=${encodeURIComponent(scope)}&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  },

  async exchangeCode(code, redirectUri) {
    if (!CLIENT_KEY || !CLIENT_SECRET) throw new Error("Credenciais do TikTok não configuradas");

    const body = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const token = await jsonFetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (token.error) throw new Error(token.error_description || token.error);

    const profile = await jsonFetch(
      `${API}/user/info/?fields=open_id,union_id,display_name,avatar_url,username`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    const u = profile?.data?.user || {};

    return [{
      externalId: u.open_id || token.open_id,
      username: u.username || u.display_name || "tiktok",
      displayName: u.display_name || "",
      profilePicture: u.avatar_url || "",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : undefined,
    }];
  },

  async fetchProfile(account): Promise<ProfileInfo> {
    const profile = await jsonFetch(
      `${API}/user/info/?fields=open_id,display_name,avatar_url,username`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const u = profile?.data?.user || {};
    return {
      externalId: u.open_id || account.externalId,
      username: u.username || account.username,
      displayName: u.display_name || "",
      profilePicture: u.avatar_url || "",
    };
  },

  async publish(account: AccountContext, input: PublishInput): Promise<PublishResult> {
    if (input.mediaType !== "video") {
      throw new Error("TikTok aceita apenas vídeos nesta integração");
    }

    const init = await jsonFetch(`${API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: (input.caption || "").slice(0, 2200),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: { source: "PULL_FROM_URL", video_url: input.mediaUrl },
      }),
    });
    if (init.error && init.error.code && init.error.code !== "ok") {
      throw new Error(init.error.message || init.error.code);
    }

    const publishId = init?.data?.publish_id;
    if (!publishId) throw new Error("TikTok não retornou publish_id");

    // Acompanha o processamento
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const st = await jsonFetch(`${API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const status = st?.data?.status;
      if (status === "PUBLISH_COMPLETE") break;
      if (status === "FAILED") {
        throw new Error(st?.data?.fail_reason || "Falha na publicação do TikTok");
      }
      if (i === 59) throw new Error("Tempo esgotado no processamento do TikTok");
    }

    return {
      remotePostId: publishId,
      permalink: account.username ? `https://www.tiktok.com/@${account.username}` : "",
    };
  },
};
