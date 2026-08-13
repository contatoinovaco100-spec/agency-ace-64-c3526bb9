import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.taxId ?? '').replace(/\D/g, '');

    if (raw.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido. Informe 14 dígitos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('CNPJA_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'CNPJA_API_KEY não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(`https://api.cnpja.com/office/${raw}`);
    url.searchParams.set('simples', 'true');
    url.searchParams.set('registrations', 'BR');
    url.searchParams.set('geocoding', 'true');

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });

    const text = await res.text();
    if (!res.ok) {
      let message = `Erro na consulta (${res.status}).`;
      if (res.status === 404) message = 'CNPJ não encontrado na Receita Federal.';
      if (res.status === 401 || res.status === 403) message = 'Chave da API CNPJá inválida ou sem permissão.';
      if (res.status === 429) message = 'Limite de consultas atingido. Tente novamente em instantes.';
      console.error('cnpja error', res.status, text);
      return new Response(JSON.stringify({ error: message }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('cnpj-lookup failure', e);
    return new Response(JSON.stringify({ error: 'Falha inesperada na consulta.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
