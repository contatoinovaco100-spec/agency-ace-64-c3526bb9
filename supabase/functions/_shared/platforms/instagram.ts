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
const APP_ID = Deno.env.get("META_APP_ID") || "2235928767163276";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

/** Aguarda o container ficar FINISHED (vídeo demora bem mais que imagem). */
async function waitContainer(token: string, containerId: string, isVideo: boolean) {
  const maxTries = isVideo ? 60 : 15;
  const waitMs = isVideo ? 5000 : 3000;
  let noStatus = 0;
  for (let i = 0; i < maxTries; i++) {
    await sleep(waitMs);
    let st: any;
    try {
      st = await jsonFetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    } catch (_) {
      continue;
    }
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
      throw new Error(`Falha no processamento da mídia: ${st.status || st.status_code}`);
    }
    if (!st.status_code) {
      noStatus++;
      if (!isVideo && noStatus >= 2) return;
    }
  }
  if (isVideo) throw new Error("Tempo esgotado no processamento da mídia");
}

async function publishContainer(account: AccountContext, containerId: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("creation_id", containerId);
  params.set("access_token", account.accessToken);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const published = await jsonFetch(`${GRAPH}/${account.externalId}/media_publish`, {
        method: "POST",
        body: params,
      });
      return published.id;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/Media ID is not available|not available|transient/i.test(msg)) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function addFirstComment(account: AccountContext, postId: string, comment?: string) {
  if (!comment) return;
  try {
    const cp = new URLSearchParams();
    cp.set("message", comment);
    cp.set("access_token", account.accessToken);
    await jsonFetch(`${GRAPH}/${postId}/comments`, { method: "POST", body: cp });
  } catch (_) { /* opcional */ }
}

async function getPermalink(account: AccountContext, postId: string): Promise<string> {
  try {
    const info = await jsonFetch(
      `${GRAPH}/${postId}?fields=permalink&access_token=${account.accessToken}`,
    );
    return info.permalink || "";
  } catch (_) {
    return "";
  }
}



export const instagramAdapter: PlatformAdapter = {
  id: "instagram",

  authUrl(redirectUri, state) {
    const scope = [
      "instagram_basic",
      "instagram_manage_insights",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "read_insights",
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
    if (!accounts.length) {
      const names = (pages.data || []).map((p: any) => p.name).join(", ");
      throw new Error(
        names
          ? `Nenhuma conta do Instagram Business vinculada às Páginas: ${names}. ` +
            `Converta o perfil para Comercial/Criador e vincule-o à Página no Facebook.`
          : "Nenhuma Página do Facebook foi autorizada. Refaça o login marcando a Página do cliente.",
      );
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
    const isVideo = input.mediaType === "video";
    const urls = (input.mediaUrls && input.mediaUrls.length ? input.mediaUrls : [input.mediaUrl])
      .filter(Boolean);
    const types = input.mediaTypes && input.mediaTypes.length === urls.length
      ? input.mediaTypes
      : urls.map(() => (isVideo ? "video" : "image") as "video" | "image");
    const wantsCarousel = input.postType === "carousel" || urls.length > 1;
    const postType = input.postType && input.postType !== "auto"
      ? input.postType
      : (isVideo ? "reels" : "image");
    const isStory = postType === "stories";

    // ---- Carrossel (até 10 mídias) ----
    if (wantsCarousel && !isStory) {
      const children: string[] = [];
      for (let i = 0; i < Math.min(urls.length, 10); i++) {
        const cp = new URLSearchParams();
        cp.set("access_token", account.accessToken);
        cp.set("is_carousel_item", "true");
        if (types[i] === "video") {
          cp.set("media_type", "VIDEO");
          cp.set("video_url", urls[i]);
        } else {
          cp.set("image_url", urls[i]);
        }
        const item = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
          method: "POST",
          body: cp,
        });
        await waitContainer(account.accessToken, item.id, types[i] === "video");
        children.push(item.id);
      }

      const parentParams = new URLSearchParams();
      parentParams.set("access_token", account.accessToken);
      parentParams.set("media_type", "CAROUSEL");
      parentParams.set("children", children.join(","));
      parentParams.set("caption", input.caption || "");
      if (input.locationId) parentParams.set("location_id", input.locationId);
      if (input.collaborators?.length) {
        parentParams.set("collaborators", JSON.stringify(input.collaborators.slice(0, 3)));
      }
      const parent = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
        method: "POST",
        body: parentParams,
      });
      await waitContainer(account.accessToken, parent.id, true);
      const publishedId = await publishContainer(account, parent.id);
      await addFirstComment(account, publishedId, input.firstComment);
      return { remotePostId: publishedId, permalink: await getPermalink(account, publishedId) };
    }


    const params = new URLSearchParams();
    params.set("access_token", account.accessToken);
    if (!isStory) params.set("caption", input.caption || "");

    if (isVideo) {
      params.set("media_type", isStory ? "STORIES" : "REELS");
      params.set("video_url", input.mediaUrl);
      if (!isStory) {
        params.set("share_to_feed", input.shareToFeed === false ? "false" : "true");
        if (input.coverUrl) params.set("cover_url", input.coverUrl);
        else if (input.thumbOffset) params.set("thumb_offset", String(input.thumbOffset));
        if (input.audioName) params.set("audio_name", input.audioName);
      }
    } else {
      if (isStory) params.set("media_type", "STORIES");
      params.set("image_url", input.mediaUrl);
    }

    if (!isStory) {
      if (input.locationId) params.set("location_id", input.locationId);
      if (input.collaborators?.length) {
        params.set("collaborators", JSON.stringify(input.collaborators.slice(0, 3)));
      }
      if (!isVideo && input.userTags?.length) {
        params.set(
          "user_tags",
          JSON.stringify(
            input.userTags.slice(0, 20).map((t) => ({
              username: t.username,
              x: typeof t.x === "number" ? t.x : 0.5,
              y: typeof t.y === "number" ? t.y : 0.5,
            })),
          ),
        );
      }
    }

    const container = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
      method: "POST",
      body: params,
    });


    // Aguarda o container ficar pronto (vídeo ~5 min, imagem ~45s)
    const maxTries = input.mediaType === "video" ? 60 : 15;
    const waitMs = input.mediaType === "video" ? 5000 : 3000;
    let ready = false;
    let noStatus = 0;
    for (let i = 0; i < maxTries; i++) {
      await sleep(waitMs);
      let st: any;
      try {
        st = await jsonFetch(
          `${GRAPH}/${container.id}?fields=status_code,status&access_token=${account.accessToken}`,
        );
      } catch (_) {
        continue;
      }
      if (st.status_code === "FINISHED") { ready = true; break; }
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        throw new Error(`Falha no processamento da mídia: ${st.status || st.status_code}`);
      }
      if (!st.status_code) {
        noStatus++;
        // imagens nem sempre expõem status_code — segue após algumas checagens
        if (input.mediaType !== "video" && noStatus >= 2) { ready = true; break; }
      }
    }
    if (!ready && input.mediaType === "video") {
      throw new Error("Tempo esgotado no processamento do vídeo");
    }


    const publishParams = new URLSearchParams();
    publishParams.set("creation_id", container.id);
    publishParams.set("access_token", account.accessToken);

    let published: any;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        published = await jsonFetch(`${GRAPH}/${account.externalId}/media_publish`, {
          method: "POST",
          body: publishParams,
        });
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // container ainda não indexado pela Meta — tenta de novo
        if (/Media ID is not available|not available|transient/i.test(msg)) {
          await sleep(5000 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
    if (lastErr) throw lastErr;


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
