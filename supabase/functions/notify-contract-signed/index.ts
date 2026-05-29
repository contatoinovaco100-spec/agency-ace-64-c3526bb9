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

    // Verify signature exists
    const { data: signature } = await supabase
      .from('contract_signatures')
      .select('id')
      .eq('contract_id', contract_id)
      .maybeSingle();

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Contract has not been signed yet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update contract status to assinado since frontend might fail due to RLS
    if (contract.status !== 'assinado') {
      await supabase.from('contracts').update({ status: 'assinado' }).eq('id', contract_id);
    }

    // Auto-create client in CRM if not already existing
    try {
      const clientName = (contract.client_name || '').trim();
      if (clientName) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .ilike('company_name', clientName)
          .maybeSingle();

        if (!existing) {
          const { error: insertErr } = await supabase.from('clients').insert({
            company_name: clientName,
            contact_name: signer_name || clientName,
            email: contract.client_email || '',
            phone: '',
            contract_start_date: new Date().toISOString().split('T')[0],
            monthly_value: Number(contract.monthly_value) || 0,
            scope: contract.scope_description || contract.services || (contract.plan_name ? `Plano ${contract.plan_name}` : ''),
            service_type: [],
            account_manager: '',
            status: 'Ativo',
            notes: `Cliente criado automaticamente ao assinar contrato "${contract.title}".`,
          });
          if (insertErr) console.error('Failed to auto-create client:', insertErr);
          else console.log('Client auto-created:', clientName);
        } else {
          console.log('Client already exists, skipping:', clientName);
        }
      }
    } catch (e) {
      console.error('Auto-create client error:', e);
    }

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
      `✍️ Assinado por: ${signer_name}\n` +
      `💰 Valor: ${value}/mês\n` +
      `📅 ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const response = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: NOTIFY_PHONE, message }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Z-API send failed [${response.status}]: ${JSON.stringify(data)}`);
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
