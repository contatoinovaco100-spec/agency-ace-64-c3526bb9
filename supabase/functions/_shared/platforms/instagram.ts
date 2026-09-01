import {
  AccountContext,
  jsonFetch,
  PlatformAdapter,
  ProfileInfo,
  PublishInput,
  PublishResult,
  sleep,
} from "./types.ts";

const GRAPH = "https://graph.facebook.com/v22.0";
const APP_ID = Deno.env.get("META_APP_ID") || "2235928767163276";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

/** Erros de processamento da Meta que costumam passar em uma nova tentativa. */
const TRANSIENT_MEDIA =
  /2207052|2207003|2207020|2207001|2207026|transient|temporar|try again|unknown error/i;

/** Aguarda o container ficar FINISHED (vídeo demora bem mais que imagem). */
async function waitContainer(token: string, containerId: string, isVideo: boolean) {
  const maxTries = isVideo ? 40 : 10;
  const waitMs = isVideo ? 4000 : 2000;
  // Falha rápido em vez de consumir todo o orçamento do Edge Runtime.
  const deadline = Date.now() + (isVideo ? 150_000 : 25_000);
  let noStatus = 0;
  for (let i = 0; i < maxTries; i++) {
    if (Date.now() > deadline) break;
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

const RUPLOAD = "https://rupload.facebook.com/ig-api-upload/v22.0";
/** Evita estourar a memória do Edge Runtime no envio binário. */
const MAX_BINARY_UPLOAD_BYTES = 80 * 1024 * 1024;

/**
 * Envia o vídeo byte a byte para a Meta (upload resumável) em vez de pedir que
 * ela baixe a nossa URL assinada. É o caminho recomendado quando aparece o
 * erro 2207052 ("Media upload has failed"), quase sempre causado por falha da
 * Meta ao buscar/processar o arquivo remoto.
 * Para arquivos menores envia os bytes; para os maiores pede ao endpoint de
 * upload da Meta que busque a URL. Este fluxo é diferente do video_url comum:
 * o arquivo é transferido antes do processamento e pode ser retomado.
 */
async function createVideoContainerResumable(
  account: AccountContext,
  baseParams: URLSearchParams,
  videoUrl: string,
): Promise<string> {
  const params = new URLSearchParams(baseParams);
  params.delete("video_url");
  params.set("upload_type", "resumable");

  // A inicialização resumível exige explicitamente um destes três valores.
  // Não confiar no parâmetro herdado evita o erro "Only photo or video...".
  const isCarouselItem = params.get("is_carousel_item") === "true";
  const requestedType = params.get("media_type");
  const mediaType = isCarouselItem
    ? "VIDEO"
    : requestedType === "STORIES"
    ? "STORIES"
    : "REELS";
  params.set("media_type", mediaType);

  const container = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Object.fromEntries(params)),
  });

  let upload: Response;
  const source = await fetch(videoUrl);
  if (!source.ok) {
    throw new Error(`Não foi possível ler o vídeo armazenado (${source.status})`);
  }
  const declaredSize = Number(source.headers.get("content-length") || "0");

  if (declaredSize > 0 && declaredSize <= MAX_BINARY_UPLOAD_BYTES) {
    const bytes = new Uint8Array(await source.arrayBuffer());
    upload = await fetch(container.uri || `${RUPLOAD}/${container.id}`, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${account.accessToken}`,
        "offset": "0",
        "file_size": String(bytes.byteLength),
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
    });
  } else {
    // Não mantém vídeos grandes na memória do runtime.
    try { await source.body?.cancel(); } catch (_) { /* ignore */ }
    upload = await fetch(container.uri || `${RUPLOAD}/${container.id}`, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${account.accessToken}`,
        "file_url": videoUrl,
      },
    });
  }
  if (!upload.ok) {
    const text = await upload.text().catch(() => "");
    throw new Error(`Falha no upload do vídeo para a Meta: ${text.slice(0, 200)}`);
  }
  const uploadBody = await upload.json().catch(() => ({ success: true }));
  if (uploadBody?.success === false || uploadBody?.debug_info) {
    const detail = uploadBody?.debug_info?.message || uploadBody?.message || "Falha no processamento";
    throw new Error(`Falha no upload do vídeo para a Meta: ${String(detail).slice(0, 300)}`);
  }

  await waitContainer(account.accessToken, container.id, true);
  return container.id;
}

/**
 * Cria o container e espera o processamento, refazendo tudo quando a Meta
 * devolve um erro transitório (ex.: 2207052 — "Media upload has failed").
 * Para vídeos, tenta primeiro o upload resumável (bytes diretos).
 */
async function createContainerWithRetry(
  account: AccountContext,
  params: URLSearchParams,
  isVideo: boolean,
  tries = 3,
): Promise<string> {
  const videoUrl = params.get("video_url") || "";
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      if (isVideo && videoUrl) {
        try {
          return await createVideoContainerResumable(account, params, videoUrl);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`upload resumável falhou (tentativa ${attempt + 1}): ${msg}`);
          // Erro definitivo da Meta (ex.: formato rejeitado, 2207052 definitivo):
          // não compensa reenviar o arquivo inteiro nem cair no fluxo por URL —
          // falha rápido em vez de repetir o upload de arquivos grandes.
          if (!TRANSIENT_MEDIA.test(msg)) throw e;
          if (attempt < tries - 1) {
            await sleep(10000 * (attempt + 1));
            continue;
          }
          // última tentativa transitória: cai para o fluxo por URL abaixo
        }
      }

      const container = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
        method: "POST",
        body: new URLSearchParams(params),
      });
      await waitContainer(account.accessToken, container.id, isVideo);
      return container.id;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < tries - 1 && TRANSIENT_MEDIA.test(msg)) {
        console.warn(`container transitório falhou (tentativa ${attempt + 1}): ${msg}`);
        await sleep(15000 * (attempt + 1));
        continue;
      }
      if (TRANSIENT_MEDIA.test(msg)) {
        throw new Error(
          "A Meta não conseguiu processar o vídeo após 3 tentativas (erro temporário 2207052). " +
            "Tente novamente em alguns minutos ou reexporte o arquivo em MP4 (H.264 + AAC, até 90s).",
        );
      }
      throw e;
    }
  }
  throw lastErr;
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
        await sleep(3000 * (attempt + 1));
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
    return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${APP_ID}` +
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
    const isVideo = (input.mediaTypes?.[0] || input.mediaType) === "video";
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
        const childId = await createContainerWithRetry(account, cp, types[i] === "video");
        children.push(childId);
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

    const containerId = await createContainerWithRetry(account, params, isVideo);

    const publishParams = new URLSearchParams();
    publishParams.set("creation_id", containerId);
    publishParams.set("access_token", account.accessToken);

    let published: any;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        published = await jsonFetch(`${GRAPH}/${account.externalId}/media_publish`, {
          method: "POST",
          body: new URLSearchParams(publishParams),
        });
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // container ainda não indexado pela Meta — tenta de novo
        if (/Media ID is not available|not available|transient/i.test(msg)) {
          await sleep(3000 * (attempt + 1));
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
