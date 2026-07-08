// Envia mensagem via WhatsApp Cloud API e salva no banco
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Require a valid Supabase JWT — sending WhatsApp messages is a privileged
    // operation that costs money and must not be callable anonymously.
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = Deno.env.get('META_WA_TOKEN')!;
    const phoneId = Deno.env.get('META_WA_PHONE_ID')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { to, text, template_name, template_language, template_variables } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: 'Campo "to" obrigatório' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Normaliza telefone (só dígitos)
    const cleanTo = String(to).replace(/\D/g, '');

    // Monta payload
    let payload: any;
    if (template_name) {
      payload = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: template_name,
          language: { code: template_language || 'pt_BR' },
          ...(template_variables?.length
            ? {
                components: [
                  {
                    type: 'body',
                    parameters: template_variables.map((v: string) => ({ type: 'text', text: v })),
                  },
                ],
              }
            : {}),
        },
      };
    } else if (text) {
      payload = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'text',
        text: { body: text },
      };
    } else {
      return new Response(JSON.stringify({ error: 'Envie "text" ou "template_name"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Chama Meta
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: metaData?.error?.message, details: metaData?.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const waMessageId = metaData.messages?.[0]?.id;

    // Garante conversa
    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id')
      .eq('contact_phone', cleanTo)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from('wa_conversations')
        .insert({
          contact_phone: cleanTo,
          contact_name: cleanTo,
          last_message: text || `[template: ${template_name}]`,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      convId = newConv?.id;
    } else {
      await supabase
        .from('wa_conversations')
        .update({
          last_message: text || `[template: ${template_name}]`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', convId);
    }

    // Salva mensagem
    await supabase.from('wa_messages').insert({
      conversation_id: convId,
      wa_message_id: waMessageId,
      direction: 'out',
      type: template_name ? 'template' : 'text',
      content: text || `[template: ${template_name}]`,
      template_name: template_name || null,
      status: 'sent',
    });

    return new Response(JSON.stringify({ ok: true, wa_message_id: waMessageId, conversation_id: convId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
