// Webhook público chamado pelo Meta a cada mensagem recebida ou status update
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify Meta's X-Hub-Signature-256 header against the raw request body using
// HMAC-SHA256 with META_APP_SECRET. Constant-time comparison.
async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const providedHex = signatureHeader.slice('sha256='.length).trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (expectedHex.length !== providedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ providedHex.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // VERIFICAÇÃO INICIAL DO META (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('META_WA_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // RECEBIMENTO DE EVENTOS (POST)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Read the raw body so we can HMAC-verify Meta's signature.
    const rawBody = await req.text();
    const appSecret = Deno.env.get('META_APP_SECRET');
    if (!appSecret) {
      console.error('META_APP_SECRET is not configured; rejecting webhook event');
      return new Response('Forbidden', { status: 403 });
    }
    const isValid = await verifyMetaSignature(
      rawBody,
      req.headers.get('x-hub-signature-256'),
      appSecret
    );
    if (!isValid) {
      console.warn('Invalid Meta webhook signature');
      return new Response('Forbidden', { status: 403 });
    }

    const body = JSON.parse(rawBody);

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change) return new Response('OK', { status: 200 });

    // STATUS UPDATES (entregue, lido)
    if (change.statuses) {
      for (const s of change.statuses) {
        await supabase
          .from('wa_messages')
          .update({ status: s.status })
          .eq('wa_message_id', s.id);
      }
    }

    // MENSAGENS RECEBIDAS
    if (change.messages) {
      for (const msg of change.messages) {
        const from = msg.from;
        const contactName = change.contacts?.[0]?.profile?.name || from;

        let content = '';
        let type = msg.type;
        let mediaUrl = null;

        if (msg.type === 'text') content = msg.text?.body || '';
        else if (msg.type === 'image') content = msg.image?.caption || '[imagem]';
        else if (msg.type === 'audio') content = '[áudio]';
        else if (msg.type === 'video') content = msg.video?.caption || '[vídeo]';
        else if (msg.type === 'document') content = msg.document?.filename || '[documento]';
        else content = `[${msg.type}]`;

        // Busca/cria conversa
        const { data: existing } = await supabase
          .from('wa_conversations')
          .select('id, unread_count')
          .eq('contact_phone', from)
          .maybeSingle();

        let convId = existing?.id;
        if (!convId || !existing) {
          // Tenta vincular a lead/cliente pelo telefone
          const { data: leadMatch } = await supabase
            .from('leads')
            .select('id')
            .ilike('phone', `%${from.slice(-8)}%`)
            .maybeSingle();
          const { data: clientMatch } = await supabase
            .from('clients')
            .select('id')
            .ilike('phone', `%${from.slice(-8)}%`)
            .maybeSingle();

          const { data: newConv } = await supabase
            .from('wa_conversations')
            .insert({
              contact_phone: from,
              contact_name: contactName,
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: 1,
              lead_id: leadMatch?.id || null,
              client_id: clientMatch?.id || null,
            })
            .select('id')
            .single();
          convId = newConv?.id;
        } else {
          await supabase
            .from('wa_conversations')
            .update({
              contact_name: contactName,
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: ((existing?.unread_count) || 0) + 1,
            })
            .eq('id', convId);
        }

        await supabase.from('wa_messages').insert({
          conversation_id: convId,
          wa_message_id: msg.id,
          direction: 'in',
          type,
          content,
          media_url: mediaUrl,
          status: 'received',
        });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('webhook error', err);
    return new Response('OK', { status: 200 }); // sempre 200 pro Meta não tentar de novo
  }
});
