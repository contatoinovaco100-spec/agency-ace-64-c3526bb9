import { supabase } from '@/integrations/supabase/client';

/*
 * Registro automático de erros: tudo que quebra no navegador de alguém vai para a tabela app_errors,
 * e os admins veem em Administração → Erros (com aviso no sino).
 * Cada erro é enviado uma vez por aba, e no máximo 20 por aba, para não inundar o banco.
 */
type Kind = 'render' | 'error' | 'promise' | 'chunk';

const sent = new Set<string>();
const MAX_PER_TAB = 20;
const RELEASE = __APP_BUILD__;

// Ruídos do navegador que não são defeito da plataforma
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /AbortError|The user aborted a request/i,
  /extension:\/\//i,
];

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed/i;

export function isChunkError(message: string) {
  return CHUNK_ERROR.test(message);
}

/**
 * Depois de uma publicação nova, quem estava com a aba aberta tenta baixar arquivos que não existem mais.
 * Recarregar uma vez resolve; a marca na sessão evita ficar recarregando em ciclo.
 */
export function reloadOnceForNewVersion() {
  try {
    if (sessionStorage.getItem('reloaded-for-new-version')) return false;
    sessionStorage.setItem('reloaded-for-new-version', '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

const textOf = (err: unknown) => {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`, stack: err.stack };
  if (typeof err === 'string') return { message: err, stack: undefined };
  try { return { message: JSON.stringify(err), stack: undefined }; } catch { return { message: String(err), stack: undefined }; }
};

export async function reportError(err: unknown, kind: Kind, extraStack?: string) {
  const { message, stack } = textOf(err);
  if (!message || IGNORE.some((re) => re.test(message))) return;
  // Sem o tipo na chave: o mesmo erro pode chegar pelo ErrorBoundary e pelo window.onerror
  const key = `${message}|${location.pathname}`;
  if (sent.has(key) || sent.size >= MAX_PER_TAB) return;
  sent.add(key);

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    await supabase.from('app_errors' as never).insert({
      user_id: user?.id ?? null,
      user_email: user?.email?.slice(0, 200) ?? null,
      kind,
      message: message.slice(0, 1000),
      stack: [stack, extraStack].filter(Boolean).join('\n--- componente ---\n').slice(0, 6000) || null,
      path: (location.pathname + location.search).slice(0, 500),
      user_agent: navigator.userAgent.slice(0, 400),
      release: RELEASE ?? null,
    } as never);
  } catch {
    // Sem rede ou tabela ainda não criada: não há o que fazer, e não pode gerar outro erro
  }
}

let installed = false;

/** Liga a captura global (erros soltos e promessas rejeitadas). Chamar uma vez no início. */
export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    const message = e.error?.message ?? e.message ?? '';
    if (isChunkError(message) && reloadOnceForNewVersion()) return;
    reportError(e.error ?? e.message, isChunkError(message) ? 'chunk' : 'error');
  });

  window.addEventListener('unhandledrejection', (e) => {
    const message = e.reason instanceof Error ? e.reason.message : String(e.reason ?? '');
    if (isChunkError(message) && reloadOnceForNewVersion()) return;
    reportError(e.reason, isChunkError(message) ? 'chunk' : 'promise');
  });

  // O Vite avisa quando um arquivo da versão antiga não existe mais
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnceForNewVersion()) e.preventDefault();
  });
}
