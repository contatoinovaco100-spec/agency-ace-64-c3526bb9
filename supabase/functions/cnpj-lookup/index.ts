import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(typeof data === 'string' ? data : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('CNPJA_API_KEY');
    const mode = String(body?.mode ?? 'lookup');

    // ---------- Busca por nicho / localização ----------
    if (mode === 'search') {
      if (!apiKey) {
        return json({ error: 'Busca por nicho exige a chave da API CNPJá configurada.' }, 400);
      }

      const url = new URL('https://api.cnpja.com/office');
      const cnaes: string[] = Array.isArray(body?.cnaes) ? body.cnaes.filter(Boolean) : [];
      const state = String(body?.state ?? '').trim();
      const cities: string[] = Array.isArray(body?.cities)
        ? body.cities.map((c: string) => String(c).trim()).filter(Boolean)
        : [];
      const limit = Math.min(Math.max(Number(body?.limit ?? 20), 1), 50);
      const page = Math.max(Number(body?.page ?? 1), 1);

      if (!cnaes.length && !state && !cities.length) {
        return json({ error: 'Informe pelo menos um nicho ou uma localização.' }, 400);
      }

      if (cnaes.length) url.searchParams.set('mainActivity.in', cnaes.join(','));
      if (state) url.searchParams.set('address.state.in', state);
      if (cities.length) url.searchParams.set('address.city.in', cities.join(','));
      if (body?.onlyActive !== false) url.searchParams.set('status.in', '2');
      if (body?.onlyHead !== false) url.searchParams.set('head.eq', 'true');
      if (body?.withPhone) url.searchParams.set('phones.type.in', 'LANDLINE,MOBILE');
      if (body?.withEmail) url.searchParams.set('emails.ownership.in', 'CORPORATE,ACCOUNTING,PERSONAL');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('page', String(page));

      const res = await fetch(url.toString(), { headers: { Authorization: apiKey.trim() } });
      const text = await res.text();
      if (!res.ok) {
        let message = `Erro na busca (${res.status}).`;
        if (res.status === 401 || res.status === 403)
          message = 'Chave da API CNPJá inválida ou sem permissão para busca avançada.';
        if (res.status === 429) message = 'Limite de consultas atingido. Tente novamente em instantes.';
        console.error('cnpja search error', res.status, text);
        return json({ error: message }, res.status);
      }
      return json(text);
    }

    // ---------- Consulta por CNPJ ----------
    const raw = String(body?.taxId ?? '').replace(/\D/g, '');
    if (raw.length !== 14) {
      return json({ error: 'CNPJ inválido. Informe 14 dígitos.' }, 400);
    }

    if (!apiKey) {
      return json({ error: 'CNPJA_API_KEY não configurada.' }, 500);
    }

    const url = new URL(`https://api.cnpja.com/office/${raw}`);
    url.searchParams.set('simples', 'true');
    url.searchParams.set('registrations', 'BR');
    url.searchParams.set('geocoding', 'true');

    let res = await fetch(url.toString(), { headers: { Authorization: apiKey.trim() } });

    // Fallback: API pública gratuita do CNPJá (limite de requisições menor)
    if (res.status === 401 || res.status === 403) {
      console.warn('cnpja: chave rejeitada, usando open.cnpja.com');
      res = await fetch(`https://open.cnpja.com/office/${raw}`);
    }

    const text = await res.text();
    if (!res.ok) {
      let message = `Erro na consulta (${res.status}).`;
      if (res.status === 404) message = 'CNPJ não encontrado na Receita Federal.';
      if (res.status === 401 || res.status === 403) message = 'Chave da API CNPJá inválida ou sem permissão.';
      if (res.status === 429) message = 'Limite de consultas atingido. Tente novamente em instantes.';
      console.error('cnpja error', res.status, text);
      return json({ error: message }, res.status);
    }

    return json(text);
  } catch (e) {
    console.error('cnpj-lookup failure', e);
    return json({ error: 'Falha inesperada na consulta.' }, 500);
  }
});
