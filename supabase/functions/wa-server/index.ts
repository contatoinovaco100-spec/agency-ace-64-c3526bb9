// Ponte entre a plataforma e o servidor WhatsApp (QR Code) da INOVA na Oracle Cloud.
// Só para usuários logados (verify_jwt): a chave do servidor (WA_API_KEY) nunca vai para o navegador.
// Ações:
//   status | groups {session?} | send {to, message, session?, lead_id?}
//   sessions | create {name, id?} | rename {session, name} | qr {session} | logout {session} | remove {session}
// "send" também registra a mensagem na conversa do CRM.
import { createClient } from "npm:@supabase/supabase-js@2";
import { findLeadByPhone, normalizePhone, recordMessage, upsertConversation } from "../_shared/crm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const serverUrl = Deno.env.get('WA_SERVER_URL');
  const apiKey = Deno.env.get('WA_API_KEY');
  if (!serverUrl || !apiKey) return json({ error: 'Servidor do WhatsApp não configurado (WA_SERVER_URL / WA_API_KEY)' }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const session = body.session ? encodeURIComponent(String(body.session)) : '';
    const call = (path: string, init: RequestInit = {}) => fetch(`${serverUrl}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...(init.headers ?? {}) },
    });

    let res: Response;
    switch (action) {
      case 'status': res = await call('/status'); break;
      case 'groups': res = await call(`/groups${session ? `?session=${session}` : ''}`); break;
      case 'sessions': res = await call('/sessions'); break;
      case 'create': res = await call('/sessions', { method: 'POST', body: JSON.stringify({ name: body.name, id: body.id }) }); break;
      case 'rename': res = await call(`/sessions/${session}`, { method: 'PATCH', body: JSON.stringify({ name: body.name }) }); break;
      case 'qr': res = await call(`/sessions/${session}/qr`); break;
      case 'logout': res = await call(`/sessions/${session}/logout`, { method: 'POST' }); break;
      case 'remove': res = await call(`/sessions/${session}`, { method: 'DELETE' }); break;
      case 'send': {
        res = await call('/send', { method: 'POST', body: JSON.stringify({ to: body.to, message: body.message, session: body.session }) });
        const data = await res.json().catch(() => ({}));
        // Mensagem para pessoa (não grupo): registra na conversa do CRM
        const phone = String(body.to ?? '').includes('@') ? null : normalizePhone(body.to);
        if (res.ok && phone) {
          const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
          const conv = await upsertConversation(admin, String(data.session ?? body.session ?? 'default'), phone, '');
          if (conv) {
            await recordMessage(admin, conv, { direction: 'out', content: String(body.message), wa_message_id: data.messageId ?? null });
            const leadId = body.lead_id ?? conv.lead_id ?? (await findLeadByPhone(admin, phone))?.id;
            if (leadId) {
              if (!conv.lead_id) await admin.from('wa_conversations').update({ lead_id: leadId }).eq('id', conv.id);
              await admin.from('leads').update({ last_outbound_at: new Date().toISOString(), contacted: true, contacted_at: new Date().toISOString() }).eq('id', leadId);
            }
          }
        }
        return json(data, res.status);
      }
      default: return json({ error: 'Ação inválida' }, 400);
    }
    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  } catch (e) {
    return json({ error: `Servidor do WhatsApp fora do ar: ${(e as Error).message}` }, 502);
  }
});
