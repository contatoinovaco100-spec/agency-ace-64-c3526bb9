import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CNPJA_API_KEY = 'c5291e75-f87c-442c-a3df-2faa02f9dd2e-908b73da-d949-47b1-829c-715e3f60af9d';

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeCnpjData(raw: any, source: 'brasilapi' | 'receitaws') {
  if (source === 'brasilapi') {
    const ddd = raw.ddd_telefone_1 || '';
    const tel = raw.telefone_1 || '';
    return {
      cnpj: raw.cnpj,
      razao_social: raw.razao_social,
      nome_fantasia: raw.nome_fantasia || null,
      situacao_cadastral: raw.descricao_situacao_cadastral || null,
      data_abertura: raw.data_inicio_atividade || null,
      natureza_juridica: raw.natureza_juridica || null,
      atividade_principal: raw.cnae_fiscal_descricao || null,
      logradouro: raw.logradouro || null,
      numero: raw.numero || null,
      complemento: raw.complemento || null,
      bairro: raw.bairro || null,
      municipio: raw.municipio || null,
      uf: raw.uf || null,
      cep: raw.cep || null,
      email: raw.email || null,
      telefone: ddd && tel ? `(${ddd}) ${tel}` : ddd || tel || null,
      porte: raw.porte || null,
      capital_social: raw.capital_social ?? null,
    };
  }
  // receitaws
  return {
    cnpj: raw.cnpj,
    razao_social: raw.nome,
    nome_fantasia: raw.fantasia || null,
    situacao_cadastral: raw.situacao || null,
    data_abertura: raw.abertura || null,
    natureza_juridica: raw.natureza_juridica || null,
    atividade_principal: raw.atividade_principal?.[0]?.text || null,
    logradouro: raw.logradouro || null,
    numero: raw.numero || null,
    complemento: raw.complemento || null,
    bairro: raw.bairro || null,
    municipio: raw.municipio || null,
    uf: raw.uf || null,
    cep: raw.cep || null,
    email: raw.email || null,
    telefone: raw.telefone || null,
    porte: raw.porte || null,
    capital_social: raw.capital_social ?? null,
  };
}

// ── Action: lookup by CNPJ ─────────────────────────────────────────────────

async function lookupByCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) {
    return jsonResponse({ error: 'CNPJ deve ter 14 dígitos.' }, 400);
  }

  // Try BrasilAPI first
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) {
      return jsonResponse({ error: 'CNPJ não encontrado na Receita Federal.' }, 404);
    }
    if (res.ok) {
      const raw = await res.json();
      return jsonResponse({ data: normalizeCnpjData(raw, 'brasilapi'), source: 'brasilapi' });
    }
    throw new Error(`BrasilAPI ${res.status}`);
  } catch (_) {
    // Fallback: ReceitaWS
    const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res2.ok) throw new Error('Serviço temporariamente indisponível. Tente novamente.');
    const raw2 = await res2.json();
    if (raw2.status === 'ERROR') {
      return jsonResponse({ error: raw2.message || 'CNPJ não encontrado.' }, 404);
    }
    return jsonResponse({ data: normalizeCnpjData(raw2, 'receitaws'), source: 'receitaws' });
  }
}

// ── Action: search by location ─────────────────────────────────────────────

async function searchByLocation(city: string, uf: string, activity: string, page: number) {
  if (!city?.trim() || !uf?.trim()) {
    return jsonResponse({ error: 'Cidade e UF são obrigatórios.' }, 400);
  }

  const apiKey = Deno.env.get('CNPJA_API_KEY') || CNPJA_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'Chave da API CNPJá não configurada. Execute o SQL de setup.' }, 500);
  }

  const ufUpper = uf.trim().toUpperCase();
  const cityTrim = city.trim();

  // 1. Validate city exists via IBGE
  const ibgeRes = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(cityTrim)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!ibgeRes.ok) throw new Error('Falha ao buscar código do município no IBGE.');
  const municipios: any[] = await ibgeRes.json();

  const match = municipios.find(
    (m: any) =>
      m.microrregiao?.mesorregiao?.UF?.sigla?.toUpperCase() === ufUpper ||
      m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla?.toUpperCase() === ufUpper
  ) || municipios[0];

  if (!match) {
    return jsonResponse({ error: `Município "${cityTrim}" não encontrado no estado ${ufUpper}.` }, 404);
  }

  // 2. Search via CNPJá API
  const url = new URL('https://api.cnpja.com/office');
  url.searchParams.set('address.state.in', ufUpper);
  url.searchParams.set('address.city.in', cityTrim);
  url.searchParams.set('status.in', '2'); // ATIVA
  url.searchParams.set('head.eq', 'true'); // Matriz
  url.searchParams.set('limit', '20');
  url.searchParams.set('page', String(page || 1));

  if (activity?.trim()) {
    url.searchParams.set('mainActivity.in', activity.trim());
  }

  const cnpjaRes = await fetch(url.toString(), {
    headers: { Authorization: apiKey.trim(), Accept: 'application/json' },
  });

  if (!cnpjaRes.ok) {
    const errText = await cnpjaRes.text();
    console.error('CNPJá search error:', cnpjaRes.status, errText);
    if (cnpjaRes.status === 401 || cnpjaRes.status === 403) {
      return jsonResponse({ error: 'Chave da API CNPJá inválida ou sem permissão para busca.' }, 403);
    }
    if (cnpjaRes.status === 429) {
      return jsonResponse({ error: 'Limite de consultas atingido. Tente novamente em instantes.' }, 429);
    }
    throw new Error('Falha ao buscar empresas. Tente novamente em instantes.');
  }

  const cnpjaData = await cnpjaRes.json();

  // Normalize CNPJá response to expected format
  const items = (cnpjaData || []).map((e: any) => ({
    cnpj: e.taxId || '',
    razao_social: e.name || e.alias || '—',
    nome_fantasia: e.alias || null,
    situacao_cadastral: e.status === 2 ? 'ATIVA' : String(e.status),
    data_abertura: e.openDate || null,
    atividade_principal: e.mainActivity?.text || null,
    logradouro: e.address?.street || null,
    numero: e.address?.number || null,
    complemento: e.address?.details || null,
    bairro: e.address?.district || null,
    municipio: e.address?.city || cityTrim,
    uf: e.address?.state || ufUpper,
    cep: e.address?.zip || null,
    email: e.emails?.[0]?.address || null,
    telefone: e.phones?.[0]
      ? `(${e.phones[0].area}) ${e.phones[0].number}`.trim()
      : null,
    porte: null,
    capital_social: null,
    natureza_juridica: e.naturezaJuridica?.text || null,
  }));

  // CNPJá returns array directly; estimate total
  const total = items.length >= 20 ? items.length * (page || 1) : items.length;

  return jsonResponse({
    items,
    municipio: match.nome,
    uf: ufUpper,
    page: page || 1,
    total,
    source: 'cnpja',
  });
}

// ── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action || 'lookup';

    if (action === 'lookup') {
      return await lookupByCnpj(body.cnpj || '');
    }

    if (action === 'search') {
      return await searchByLocation(body.city, body.uf, body.activity, body.page || 1);
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    console.error('consulta-cnpj error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
