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
    const { cnpj } = await req.json();

    if (!cnpj || typeof cnpj !== 'string') {
      return new Response(JSON.stringify({ error: 'CNPJ é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limpa o CNPJ deixando só dígitos
    const cnpjDigits = cnpj.replace(/\D/g, '');

    if (cnpjDigits.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ deve ter 14 dígitos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tenta BrasilAPI primeiro (gratuita, sem limite de uso, sem chave)
    let data: any = null;
    let source = 'brasilapi';

    try {
      const brasilApiRes = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (brasilApiRes.ok) {
        const raw = await brasilApiRes.json();
        data = {
          cnpj: raw.cnpj,
          razao_social: raw.razao_social,
          nome_fantasia: raw.nome_fantasia,
          situacao_cadastral: raw.descricao_situacao_cadastral,
          data_abertura: raw.data_inicio_atividade,
          natureza_juridica: raw.natureza_juridica,
          atividade_principal: raw.cnae_fiscal_descricao,
          logradouro: raw.logradouro,
          numero: raw.numero,
          complemento: raw.complemento,
          bairro: raw.bairro,
          municipio: raw.municipio,
          uf: raw.uf,
          cep: raw.cep,
          email: raw.email,
          telefone: raw.ddd_telefone_1
            ? `(${raw.ddd_telefone_1}) ${raw.telefone_1 || ''}`
            : null,
          porte: raw.porte,
          capital_social: raw.capital_social,
        };
      } else if (brasilApiRes.status === 404) {
        return new Response(JSON.stringify({ error: 'CNPJ não encontrado na base da Receita Federal.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        throw new Error(`BrasilAPI status ${brasilApiRes.status}`);
      }
    } catch (brasilApiErr) {
      // Fallback para ReceitaWS
      source = 'receitaws';
      const receitaRes = await fetch(
        `https://receitaws.com.br/v1/cnpj/${cnpjDigits}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!receitaRes.ok) {
        throw new Error('Serviço de consulta de CNPJ temporariamente indisponível. Tente novamente em instantes.');
      }

      const raw = await receitaRes.json();

      if (raw.status === 'ERROR') {
        return new Response(JSON.stringify({ error: raw.message || 'CNPJ não encontrado.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      data = {
        cnpj: raw.cnpj,
        razao_social: raw.nome,
        nome_fantasia: raw.fantasia,
        situacao_cadastral: raw.situacao,
        data_abertura: raw.abertura,
        natureza_juridica: raw.natureza_juridica,
        atividade_principal: raw.atividade_principal?.[0]?.text,
        logradouro: raw.logradouro,
        numero: raw.numero,
        complemento: raw.complemento,
        bairro: raw.bairro,
        municipio: raw.municipio,
        uf: raw.uf,
        cep: raw.cep,
        email: raw.email,
        telefone: raw.telefone,
        porte: raw.porte,
        capital_social: raw.capital_social,
      };
    }

    return new Response(JSON.stringify({ data, source }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno ao consultar CNPJ.';
    console.error('consulta-cnpj error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
