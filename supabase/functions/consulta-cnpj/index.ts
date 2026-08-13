import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const socios = Array.isArray(raw.qsa) ? raw.qsa.map((s: any) => s.nome_socio).filter(Boolean).join(', ') : null;
    return {
      cnpj: raw.cnpj,
      razao_social: raw.razao_social,
      nome_fantasia: raw.nome_fantasia || null,
      situacao_cadastral: raw.descricao_situacao_cadastral || null,
      data_abertura: raw.data_inicio_atividade || null,
      natureza_juridica: raw.natureza_juridica || null,
      atividade_principal: raw.cnae_fiscal_descricao || null,
      socios,
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

async function lookupByCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) {
    return jsonResponse({ error: 'CNPJ deve ter 14 dígitos.' }, 400);
  }

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

async function enrichCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const raw = await res.json();
    const ddd = raw.ddd_telefone_1 || '';
    const tel = raw.telefone_1 || '';
    const socios = Array.isArray(raw.qsa) ? raw.qsa.map((s: any) => s.nome_socio).filter(Boolean).join(', ') : null;
    return {
      cnpj: raw.cnpj,
      razao_social: raw.razao_social,
      nome_fantasia: raw.nome_fantasia || null,
      situacao_cadastral: raw.descricao_situacao_cadastral || null,
      data_abertura: raw.data_inicio_atividade || null,
      natureza_juridica: raw.natureza_juridica || null,
      atividade_principal: raw.cnae_fiscal_descricao || null,
      socios,
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
  } catch {
    return null;
  }
}

async function searchByLocation(city: string, uf: string, activity: string, bairro: string, page: number) {
  if (!city?.trim() || !uf?.trim()) {
    return jsonResponse({ error: 'Cidade e UF são obrigatórios.' }, 400);
  }

  const ufUpper = uf.trim().toUpperCase();
  const cityUpper = city.trim().toUpperCase();

  const payload: any = {
    situacao_cadastral: ['ATIVA'],
    uf: [ufUpper],
    municipio: [cityUpper],
    exclui_mei: false,
    excluir_mei: false,
    com_email: false,
    inverter_municipio: false,
    apenas_mei: false,
    com_contato_telefonico: true,
    somente_fixo: false,
    somente_celular: false,
    somente_matriz: false,
    somente_filial: false,
    limite: 20,
    pagina: page || 1,
  };

  if (activity?.trim()) {
    payload.codigo_atividade_principal = [activity.trim()];
  }

  if (bairro?.trim()) {
    payload.bairro = [bairro.trim().toUpperCase()];
  }

  const cddRes = await fetch(
    'https://api.casadosdados.com.br/v5/public/cnpj/pesquisa',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!cddRes.ok) {
    const errText = await cddRes.text();
    console.error('Casa dos Dados error:', cddRes.status, errText);
    throw new Error('Falha ao buscar empresas. Tente novamente em instantes.');
  }

  const cddData = await cddRes.json();
  const rawItems: any[] = cddData?.cnpjs || cddData?.data?.cnpj || [];

  const cnpjs = rawItems.map((e: any) => e.cnpj).filter(Boolean).slice(0, 20);
  const enriched = await Promise.all(cnpjs.map((c: string) => enrichCnpj(c)));

  const items = enriched.map((e, i) => ({
    cnpj: cnpjs[i],
    razao_social: e?.razao_social || rawItems[i]?.razao_social || '—',
    nome_fantasia: e?.nome_fantasia || rawItems[i]?.nome_fantasia || null,
    situacao_cadastral: e?.situacao_cadastral || 'ATIVA',
    data_abertura: e?.data_abertura || null,
    atividade_principal: e?.atividade_principal || null,
    socios: e?.socios || null,
    logradouro: e?.logradouro || null,
    numero: e?.numero || null,
    complemento: e?.complemento || null,
    bairro: e?.bairro || null,
    municipio: e?.municipio || cityUpper,
    uf: e?.uf || ufUpper,
    cep: e?.cep || null,
    email: e?.email || null,
    telefone: e?.telefone || null,
    porte: e?.porte || null,
    capital_social: e?.capital_social || null,
    natureza_juridica: e?.natureza_juridica || null,
  }));

  const total = cddData?.total || items.length;

  return jsonResponse({
    items,
    municipio: cityUpper,
    uf: ufUpper,
    page: page || 1,
    total,
    source: 'casadosdados+brasilapi',
  });
}

async function enrichBulk(cnpjs: string[]) {
  if (!Array.isArray(cnpjs) || cnpjs.length === 0) {
    return jsonResponse({ error: 'Envie uma lista de CNPJs.' }, 400);
  }
  const clean = cnpjs.map(c => c.replace(/\D/g, '')).filter(c => c.length === 14).slice(0, 50);
  const results = await Promise.all(clean.map(c => enrichCnpj(c)));
  return jsonResponse({ items: results.filter(Boolean) });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action || 'lookup';

    if (action === 'lookup') {
      return await lookupByCnpj(body.cnpj || '');
    }

    if (action === 'search') {
      return await searchByLocation(body.city, body.uf, body.activity, body.bairro, body.page || 1);
    }

    if (action === 'enrich') {
      return await enrichBulk(body.cnpjs || []);
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    console.error('consulta-cnpj error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
