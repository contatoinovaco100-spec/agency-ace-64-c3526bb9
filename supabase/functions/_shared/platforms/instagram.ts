import {
  AccountContext,
  ContainerPendingError,
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

/** Aguarda o container ficar FINISHED (vídeo demora bem mais que imagem).
 *  Se o tempo acabar e o container já tiver sido criado, não falha de vez:
 *  joga ContainerPendingError com o id do container para ele ser finalizado
 *  em segundo plano (cron), sem depender do teto de tempo de uma Edge Function.
 *  Vídeos de até alguns minutos ficam prontos na própria chamada, então o
 *  usuário recebe o resultado imediatamente. */
async function waitContainer(
  token: string,
  containerId: string,
  isVideo: boolean,
  maxWaitMs = isVideo ? 170_000 : 30_000,
) {
  const waitMs = isVideo ? 3000 : 1500;
  const deadline = Date.now() + maxWaitMs;
  let noStatus = 0;
  for (;;) {
    if (Date.now() > deadline) break;
    await sleep(waitMs);
    let st: any;
    try {
      st = await jsonFetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Token de acesso|OAuthException|Permissão/i.test(msg)) throw err;
      continue;
    }
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
      throw new Error(`Falha no processamento da mídia pela Meta: ${st.status || st.status_code}`);
    }
    if (!st.status_code) {
      noStatus++;
      if (!isVideo && noStatus >= 2) return;
    }
  }
  if (isVideo) {
    // Container aceito mas ainda IN_PROGRESS (vídeo longo codificando) —
    // entrega o id para a finalização em segundo plano.
    throw new ContainerPendingError(containerId);
  }
  throw new Error("Tempo esgotado no processamento da mídia pela Meta.");
}

const isAuthError = (message: string) =>
  /Token de acesso expirado|Permissão insuficiente/i.test(message);

/** A Meta ocasionalmente devolve code 190 ao criar a mídia mesmo com o token
 * ainda válido. Confirma o token antes de obrigar o usuário a reconectar. */
async function tokenIsStillValid(account: AccountContext): Promise<boolean> {
  try {
    await jsonFetch(
      `${GRAPH}/${account.externalId}?fields=id&access_token=${encodeURIComponent(account.accessToken)}`,
    );
    return true;
  } catch {
    return false;
  }
}

/** Entrega o container para a finalização em 2º plano (cron). Em carrosséis
 * isso não é possível, então vira erro definitivo com mensagem clara. */
const requireContainerNotPending = (e: unknown, allowPendings: boolean) => {
  if (isContainerPending(e) && !allowPendings) {
    throw new Error(
      "O vídeo é longo demais e o processamento da Meta demorou. Em carrosséis, use vídeos com até alguns minutos.",
    );
  }
};

const RUPLOAD = "https://rupload.facebook.com/ig-api-upload/v22.0";
/** Evita estourar a memória do Edge Runtime no envio binário. */
const MAX_BINARY_UPLOAD_BYTES = 80 * 1024 * 1024;

/**
 * Envia o vídeo byte a byte para a Meta (upload resumável) em vez de pedir que
 * ela baixe a nossa URL assinada. É o caminho recomendado quando aparece o
 * erro 2207052 ("Media upload has failed"), quase sempre causado por falha da
 * Meta ao buscar/processar o arquivo remoto.
 */
async function createVideoContainerResumable(
  account: AccountContext,
  baseParams: URLSearchParams,
  videoUrl: string,
): Promise<string> {
  const params = new URLSearchParams(baseParams);
  params.delete("video_url");
  params.set("upload_type", "resumable");

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
  const source = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
  if (!source.ok) {
    throw new Error(`Não foi possível ler o vídeo armazenado (${source.status})`);
  }
  const declaredSize = Number(source.headers.get("content-length") || "0");

  if (declaredSize > 0 && declaredSize <= MAX_BINARY_UPLOAD_BYTES) {
    // Faz streaming: não materializa o vídeo inteiro na memória do runtime.
    upload = await fetch(container.uri || `${RUPLOAD}/${container.id}`, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${account.accessToken}`,
        "offset": "0",
        "file_size": String(declaredSize),
        "Content-Type": "application/octet-stream",
      },
      body: source.body,
      // @ts-ignore: exigido pelo fetch do Deno para corpos em stream
      duplex: "half",
      signal: AbortSignal.timeout(240_000),
    });
  } else {
    try { await source.body?.cancel(); } catch (_) { /* ignore */ }
    upload = await fetch(container.uri || `${RUPLOAD}/${container.id}`, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${account.accessToken}`,
        "file_url": videoUrl,
      },
      signal: AbortSignal.timeout(240_000),
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

async function createContainerFromUrl(
  account: AccountContext,
  params: URLSearchParams,
  isVideo: boolean,
  allowPendings: boolean,
): Promise<string> {
  const container = await jsonFetch(`${GRAPH}/${account.externalId}/media`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  try {
    await waitContainer(account.accessToken, container.id, isVideo);
  } catch (e) {
    requireContainerNotPending(e, allowPendings);
    throw e;
  }
  return container.id;
}

/**
 * Cria o container e espera o processamento.
 * Falha rápido em erros definitivos (ex.: token expirado, permissão, proporção);
 * em vídeos longos devolve ContainerPendingError para finalizar em 2º plano.
 */
async function createContainerWithRetry(
  account: AccountContext,
  params: URLSearchParams,
  isVideo: boolean,
  tries = 2,
  allowPendings = true,
): Promise<string> {
  const videoUrl = params.get("video_url") || "";
  let lastErr: unknown;

  // 1) A Meta busca a URL assinada diretamente. É o caminho mais rápido porque
  // evita baixar o vídeo no backend e reenviá-lo inteiro uma segunda vez.
  if (isVideo && videoUrl) {
    try {
      return await createContainerFromUrl(account, params, true, allowPendings);
    } catch (e) {
      if (isContainerPending(e)) throw e; // vídeo longo aceito — finaliza em 2º plano
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        if (!(await tokenIsStillValid(account))) throw e;
        console.warn("Meta recusou temporariamente um token válido; tentando novamente");
        await sleep(1200);
        return await createContainerFromUrl(account, params, true, allowPendings);
      }
      if (/Proporção/i.test(msg) || !TRANSIENT_MEDIA.test(msg)) throw e;
      console.warn(`importação rápida falhou; usando upload alternativo: ${msg}`);
    }

    // 2) Só usa o envio binário, mais pesado, se a importação rápida falhar.
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        return await createVideoContainerResumable(account, params, videoUrl);
      } catch (e) {
        requireContainerNotPending(e, allowPendings);
        if (isContainerPending(e)) throw e; // container já aceito — finaliza em 2º plano
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`upload alternativo falhou (tentativa ${attempt + 1}): ${msg}`);
        if (isAuthError(msg)) {
          if (!(await tokenIsStillValid(account))) throw e;
        } else if (!TRANSIENT_MEDIA.test(msg)) {
          throw e;
        }
        if (attempt < tries - 1) await sleep(2000);
      }
    }
    throw lastErr;
  }

  // Imagens (e stories) não precisam passar pelo upload binário.
  return await createContainerFromUrl(account, params, false, allowPendings);
}

async function publishContainer(account: AccountContext, containerId: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("creation_id", containerId);
  params.set("access_token", account.accessToken);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const published = await jsonFetch(`${GRAPH}/${account.externalId}/media_publish`, {
        method: "POST",
        body: params,
      });
      return published.id;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/Token de acesso|OAuthException|Permissão/i.test(msg)) throw e;
      if (/Media ID is not available|not available|transient/i.test(msg)) {
        await sleep(2000 * (attempt + 1));
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

/**
 * Renova o page token usando o token de usuário (long-lived) guardado como
 * refresh token. Também renova o token de usuário (60 dias) via
 * fb_exchange_token enquanto ainda for válido. Assim um page token revogado
 * ou expirado é trocado em silêncio, sem o cliente reconectar a conta.
 */
async function refreshAccountToken(
  account: AccountContext,
  userToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string }> {
  let renewedUser = userToken;
  if (APP_SECRET && userToken) {
    try {
      const long = await jsonFetch(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}` +
          `&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(userToken)}`,
      );
      if (long.access_token) renewedUser = long.access_token;
    } catch {
      // token de usuário pode já ter expirado — seguimos tentando com o antigo
    }
  }
  const pages = await jsonFetch(
    `${GRAPH}/me/accounts?fields=name,access_token,instagram_business_account{id}&limit=200&access_token=${renewedUser}`,
  );
  for (const page of pages.data || []) {
    const ig = page.instagram_business_account;
    if (!ig || String(ig.id) !== String(account.externalId)) continue;
    return {
      accessToken: page.access_token || renewedUser,
      refreshToken: renewedUser,
      expiresAt: undefined, // page tokens long-lived não têm expiração conhecida
    };
  }
  throw new Error("A Página/Instagram desta conta não foi encontrada para renovar o token.");
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
        // Guarda o token de USUÁRIO (long-lived) como refresh: com ele podemos
        // renovar o page token depois sem pedir reconexão ao cliente.
        refreshToken: userToken,
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

  async refreshedToken(account, refreshToken) {
    const r = await refreshAccountToken(account, refreshToken);
    return { accessToken: r.accessToken, expiresAt: r.expiresAt };
  },

  /** Finaliza um container já aceito (vídeo longo): espera o FINISHED num
   *  orçamento curto e publica. Se ainda não terminou, devolve
   *  ContainerPendingError para o cron continuar nos próximos ciclos. */
  async finishedContainer(account, containerId, input): Promise<PublishResult> {
    const deadline = Date.now() + 120_000;
    for (;;) {
      await sleep(15_000);
      let st: any;
      try {
        st = await jsonFetch(
          `${GRAPH}/${containerId}?fields=status_code,status&access_token=${account.accessToken}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Token de acesso|OAuthException|Permissão/i.test(msg)) throw err;
        continue;
      }
      if (st.status_code === "PUBLISHED") {
        return { remotePostId: containerId, permalink: await getPermalink(account, containerId) };
      }
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        throw new Error(`Falha no processamento da mídia pela Meta: ${st.status || st.status_code}`);
      }
      if (Date.now() > deadline) throw new ContainerPendingError(containerId);
    }
    const publishedId = await publishContainer(account, containerId);
    await addFirstComment(account, publishedId, input.firstComment);
    return { remotePostId: publishedId, permalink: await getPermalink(account, publishedId) };
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
        const childId = await createContainerWithRetry(account, cp, types[i] === "video", 2, false);
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
      if (isStory) {
        params.set("media_type", "STORIES");
      } else {
        params.set("media_type", "REELS");
        params.set("share_to_feed", input.shareToFeed === false ? "false" : "true");
        if (input.coverUrl) params.set("cover_url", input.coverUrl);
        else if (input.thumbOffset) params.set("thumb_offset", String(input.thumbOffset));
        if (input.audioName) params.set("audio_name", input.audioName);
      }
      params.set("video_url", input.mediaUrl);
    } else {
      // Foto / Imagem única
      if (isStory) {
        params.set("media_type", "STORIES");
      } else {
        params.delete("media_type"); // Foto simples no Feed não deve enviar media_type
      }
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

    // Reaproveita a lógica única de publicação com retry.
    const published = { id: await publishContainer(account, containerId) };




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
