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
  mediaType: "video" | "image";
  caption: string;
  firstComment?: string;
  thumbnailUrl?: string;
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
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error?.message_detail || body?.message || text;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return body;
}
