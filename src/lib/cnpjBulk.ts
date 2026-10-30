/**
 * Busca grande de empresas (100, 500, 1000) feita direto do navegador.
 * A função consulta-cnpj consulta 20 CNPJs de uma vez na BrasilAPI a partir do servidor e
 * passa a ser bloqueada depois de poucas buscas seguidas; daqui saem poucas consultas por vez,
 * do IP de quem está usando, alternando a fonte quando uma bloqueia.
 */

export type CnpjSearch = { city: string; uf: string; activity?: string; bairro?: string };

type CddItem = { cnpj: string; razao_social?: string; nome_fantasia?: string };

/** Uma página da Casa dos Dados (sempre 20); as seguintes vêm excluindo os CNPJs já vistos */
export async function searchCnpjs(q: CnpjSearch, exclude: string[]) {
  const payload: Record<string, unknown> = {
    situacao_cadastral: ['ATIVA'],
    uf: [q.uf.trim().toUpperCase()],
    municipio: [q.city.trim().toUpperCase()],
    com_contato_telefonico: true,
    somente_celular: true,
    limite: 20,
    pagina: 1,
  };
  if (q.activity?.trim()) payload.codigo_atividade_principal = [q.activity.trim()];
  if (q.bairro?.trim()) payload.bairro = [q.bairro.trim().toUpperCase()];
  if (exclude.length) payload.excluir = { cnpj: exclude };

  const res = await fetch('https://api.casadosdados.com.br/v5/public/cnpj/pesquisa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Falha ao buscar empresas. Tente novamente em instantes.');
  const data = await res.json();
  return { items: (data?.cnpjs || []) as CddItem[], total: Number(data?.total) || 0 };
}

function formatPhone(ddd: string | null | undefined) {
  const d = String(ddd ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    const num = d.slice(2);
    return num[0] === '9' ? `(${d.slice(0, 2)}) 9${num}` : `(${d.slice(0, 2)}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Duas fontes com o mesmo formato (a BrasilAPI usa a base da Minha Receita). Cada uma libera
 * umas 100 consultas e depois bloqueia por um tempo: quando uma bloqueia, descansa e a outra assume.
 */
const SOURCES = [
  { url: (c: string) => `https://brasilapi.com.br/api/cnpj/v1/${c}`, until: 0 },
  { url: (c: string) => `https://minhareceita.org/${c}`, until: 0 },
];
const COOLDOWN_MS = 45_000;
let turn = 0;

/** Avisa a tela quando as duas fontes estão bloqueadas e a busca está esperando */
export type WaitListener = (waitingMs: number) => void;

async function fetchCnpj(cnpj: string, onWait?: WaitListener, signal?: { stopped: boolean }) {
  let notFound = 0;
  // Desiste do CNPJ depois de ~5 min com as duas fontes bloqueadas
  for (let attempt = 0; attempt < 14 && !signal?.stopped; attempt++) {
    const now = Date.now();
    const ready = SOURCES.filter((s) => s.until <= now);
    if (!ready.length) {
      const wait = Math.min(...SOURCES.map((s) => s.until)) - now;
      onWait?.(wait);
      await sleep(Math.min(wait, 5000));
      continue;
    }
    const src = ready[turn++ % ready.length];
    try {
      const res = await fetch(src.url(cnpj));
      if (res.ok) { onWait?.(0); return await res.json(); }
      if (res.status === 404) { if (++notFound >= SOURCES.length) return null; continue; }
      src.until = Date.now() + COOLDOWN_MS; // 429 ou erro do servidor
    } catch {
      src.until = Date.now() + COOLDOWN_MS; // bloqueio chega sem permissão de CORS e vira erro de rede
    }
  }
  return null;
}

/** Dados completos do CNPJ (null quando não achou) */
export async function enrichCnpj(cnpj: string, fallback: CddItem, onWait?: WaitListener, signal?: { stopped: boolean }) {
  const raw = await fetchCnpj(cnpj, onWait, signal);
  if (!raw) return null;
  const phones = [formatPhone(raw.ddd_telefone_1), formatPhone(raw.ddd_telefone_2)].filter(Boolean);
  return {
    cnpj,
    razao_social: raw.razao_social || fallback.razao_social || '—',
    nome_fantasia: raw.nome_fantasia || fallback.nome_fantasia || null,
    situacao_cadastral: raw.descricao_situacao_cadastral || 'ATIVA',
    data_abertura: raw.data_inicio_atividade || null,
    natureza_juridica: raw.natureza_juridica || null,
    atividade_principal: raw.cnae_fiscal_descricao || null,
    socios: Array.isArray(raw.qsa) ? raw.qsa.map((s: { nome_socio?: string }) => s.nome_socio).filter(Boolean).join(', ') || null : null,
    logradouro: raw.logradouro || null,
    numero: raw.numero || null,
    complemento: raw.complemento || null,
    bairro: raw.bairro || null,
    municipio: raw.municipio || null,
    uf: raw.uf || null,
    cep: raw.cep || null,
    email: raw.email || null,
    telefone: phones.length ? phones.join(' / ') : null,
    porte: raw.porte || null,
    capital_social: raw.capital_social ?? null,
  };
}

/** Roda as consultas com poucas ao mesmo tempo */
export async function mapLimited<T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  }));
  return out;
}
