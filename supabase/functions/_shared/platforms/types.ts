// Contratos compartilhados entre os adaptadores de plataforma.
// Para adicionar uma nova rede (Facebook, LinkedIn, YouTube, X, Threads...)
// basta criar um arquivo que implemente PlatformAdapter e registrá-lo em registry.ts.

export interface AccountContext {
  id: string;
  externalId: string;
  username: string;
  accessToken: string;
  refreshToken?: string;
}

export interface PublishInput {
  mediaUrl: string;
  /** Para carrossel: várias mídias na ordem */
  mediaUrls?: string[];
  mediaTypes?: Array<"video" | "image">;
  mediaType: "video" | "image";
  caption: string;
  firstComment?: string;
  thumbnailUrl?: string;
  /** auto | reels | image | stories */
  postType?: string;
  shareToFeed?: boolean;
  collaborators?: string[];
  locationId?: string;
  userTags?: Array<{ username: string; x?: number; y?: number }>;
  coverUrl?: string;
  thumbOffset?: number;
  audioName?: string;
}


export interface PublishResult {
  remotePostId: string;
  permalink: string;
}

export interface ProfileInfo {
  externalId: string;
  username: string;
  displayName: string;
  profilePicture: string;
}

export interface PlatformAdapter {
  id: string;
  /** URL de autorização OAuth */
  authUrl(redirectUri: string, state: string): string;
  /** Troca o code por token(s) e devolve as contas encontradas */
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Array<ProfileInfo & { accessToken: string; refreshToken?: string; expiresAt?: string }>>;
  /** Publica um conteúdo na conta */
  publish(account: AccountContext, input: PublishInput): Promise<PublishResult>;
  /** Revalida perfil / status do token */
  fetchProfile(account: AccountContext): Promise<ProfileInfo>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function jsonFetch(url: string, init?: RequestInit) {
  // Sem timeout, uma conexão travada com a Meta segura o isolate até morrer.
  const res = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(45_000) });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const errObj = body?.error;
    let msg = errObj?.message || errObj?.message_detail || body?.message || text;
    const code = errObj?.code;
    const subcode = errObj?.error_subcode;
    const type = errObj?.type;

    // Erros conhecidos de autenticação / permissão da Meta
    if (type === "OAuthException" || code === 190 || subcode === 463 || subcode === 467 || /access token/i.test(msg)) {
      msg = "Token de acesso expirado ou inválido. Reconecte sua conta do Instagram/Facebook.";
    } else if (code === 10 || code === 200 || /permission/i.test(msg)) {
      msg = "Permissão insuficiente na Página/Instagram. Reconecte a conta garantindo todas as permissões.";
    } else if (/aspect ratio/i.test(msg) || /invalid aspect ratio/i.test(msg)) {
      msg = "Proporção de imagem/vídeo inválida para o Instagram. Use formato entre 4:5 e 1.91:1.";
    }

    throw new Error(`[${res.status}] ${msg}`);
  }
  return body;
}
