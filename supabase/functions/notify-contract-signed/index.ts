import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contract_id, signer_name } = await req.json();

    if (!contract_id || !signer_name) {
      return new Response(JSON.stringify({ error: 'contract_id and signer_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify contract exists
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify a real accepted signature exists for this contract before doing
    // anything privileged (updating status, creating clients, sending notifications).
    const { data: signature } = await supabase
      .from('contract_signatures')
      .select('id, accepted, signer_name')
      .eq('contract_id', contract_id)
      .eq('accepted', true)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Contract has not been signed yet' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trust the signer_name recorded server-side rather than the request body.
    const trustedSignerName = signature.signer_name || signer_name;

    // Update contract status to assinado since frontend might fail due to RLS
    if (contract.status !== 'assinado') {
      await supabase.from('contracts').update({ status: 'assinado' }).eq('id', contract_id);
    }

    // NOTA: a criação automática do cliente é feita pelo trigger do banco de dados
    // `auto_create_client_on_signature` (AFTER INSERT em contract_signatures), que
    // usa uma advisory lock por nome para impedir duplicidade. NÃO recriar o cliente
    // aqui — fazíamos isso antigamente e gerava clientes duplicados por correr em
    // paralelo com o trigger (race condition).

    const INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');

    if (!INSTANCE_ID || !ZAPI_TOKEN) {
      console.warn('Z-API credentials not configured, skipping WhatsApp notification');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ZAPI_BASE = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${ZAPI_TOKEN}`;
    const NOTIFY_PHONE = '5502481474167';

    const value = Number(contract.monthly_value).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
    });

    const message = `✅ *Contrato Assinado!*\n\n` +
      `📄 *${contract.title}*\n` +
      `👤 Cliente: ${contract.client_name}\n` +
      `✍️ Assinado por: ${trustedSignerName}\n` +
      `💰 Valor: ${value}/mês\n` +
      `📅 ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const response = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CLIENT_TOKEN ? { 'Client-Token': CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({ phone: NOTIFY_PHONE, message }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // A assinatura já foi registrada; não falhar a requisição por causa do WhatsApp
      console.error(`Z-API send failed [${response.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, whatsapp: false, warning: 'WhatsApp notification failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Notification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
