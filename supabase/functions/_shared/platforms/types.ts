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

/** Sinaliza que a plataforma aceitou o container mas ainda está processando
 *  (ex.: codificando um vídeo longo). O container já existe no lado dela e deve
 *  ser finalizado depois via `finishedContainer` — nunca deve ser recriado. */
export class ContainerPendingError extends Error {
  readonly containerId: string;
  constructor(containerId: string, message = "A mídia ainda está em processamento na plataforma") {
    super(message);
    this.name = "ContainerPendingError";
    this.containerId = containerId;
  }
}

export function isContainerPending(e: unknown): e is ContainerPendingError {
  return (
    !!e &&
    typeof e === "object" &&
    ((e as { name?: string }).name === "ContainerPendingError" ||
      (e as { containerId?: string }).containerId !== undefined)
  );
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
  /**
   * Renova o token de acesso da conta usando o token de usuário (long-lived)
   * guardado como refreshToken — evita ter que reconectar a conta quando um
   * page token é revogado/expirado. Devolve o novo token de acesso.
   */
  refreshedToken?(account: AccountContext, refreshToken: string): Promise<{ accessToken: string; expiresAt?: string }>;
  /**
   * Finaliza a publicação de um container que já foi aceito pela plataforma
   * mas ainda está em processamento (vídeo longo). Lança ContainerPendingError
   * se o processamento ainda não terminou nesta chamada — um agendador (cron)
   * continuará tentando em ciclos seguintes.
   */
  finishedContainer?(account: AccountContext, containerId: string, input: PublishInput): Promise<PublishResult>;
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

    // Atenção: a Meta usa "OAuthException" para vários erros comuns
    // (parâmetro inválido, mídia recusada...), então o tipo sozinho NÃO
    // significa que o token venceu.
    const realTokenError = code === 190 || subcode === 463 || subcode === 467 ||
      subcode === 460 || subcode === 492 ||
      /access token|session (is|has) (invalid|expired)/i.test(String(msg));
    if (realTokenError) {
      msg = "Token de acesso expirado ou inválido. Reconecte sua conta do Instagram/Facebook.";
    } else if (code === 10 || code === 200 || /permission/i.test(msg)) {
      msg = "Permissão insuficiente na Página/Instagram. Reconecte a conta garantindo todas as permissões.";
    } else if (/aspect ratio/i.test(msg)) {
      msg = "Proporção de imagem/vídeo inválida para o Instagram. Use formato entre 4:5 e 1.91:1.";
    } else if (type === "OAuthException" && code) {
      msg = `${msg} (código ${code}${subcode ? `/${subcode}` : ""})`;
    }

    throw new Error(`[${res.status}] ${msg}`);
  }
  return body;
}
