// Ponte entre a plataforma e o servidor WhatsApp (QR Code) da INOVA na Oracle Cloud.
// Só para usuários logados (verify_jwt): a chave do servidor (WA_API_KEY) nunca vai para o navegador.
// Ações:
//   status | groups {session?} | participants {group, session?} | send {to, message, session?, lead_id?}
//   sessions | create {name, id?} | rename {session, name} | qr {session} | logout {session} | remove {session}
//   avatars {ids}: busca a foto de perfil das conversas e guarda uma cópia no bucket wa-avatars
// "send" também registra a mensagem na conversa do CRM.
// deno-lint-ignore-file no-explicit-any
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
      case 'participants': res = await call(`/groups/${encodeURIComponent(String(body.group ?? ''))}/participants${session ? `?session=${session}` : ''}`); break;
      case 'sessions': res = await call('/sessions'); break;
      case 'create': res = await call('/sessions', { method: 'POST', body: JSON.stringify({ name: body.name, id: body.id }) }); break;
      case 'rename': res = await call(`/sessions/${session}`, { method: 'PATCH', body: JSON.stringify({ name: body.name }) }); break;
      case 'qr': res = await call(`/sessions/${session}/qr`); break;
      case 'logout': res = await call(`/sessions/${session}/logout`, { method: 'POST' }); break;
      case 'remove': res = await call(`/sessions/${session}`, { method: 'DELETE' }); break;
      case 'send': {
        res = await call('/send', { method: 'POST', body: JSON.stringify({ to: body.to, message: body.message, session: body.session }) });
        const data = await res.json().catch(() => ({}));
        // Mensagem para grupo que já tem conversa no CRM: registra nela
        if (res.ok && String(body.to ?? '').endsWith('@g.us')) {
          const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
          const { data: conv } = await admin.from('wa_conversations').select('*')
            .eq('session_id', String(data.session ?? body.session ?? 'default')).eq('contact_phone', body.to).maybeSingle();
          if (conv) await recordMessage(admin, conv, { direction: 'out', content: String(body.message), wa_message_id: data.messageId ?? null });
          return json(data, res.status);
        }
        // Mensagem para pessoa: registra na conversa do CRM
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
      case 'avatars': return json(await syncAvatars(call, (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 30)));
      default: return json({ error: 'Ação inválida' }, 400);
    }
    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  } catch (e) {
    return json({ error: `Servidor do WhatsApp fora do ar: ${(e as Error).message}` }, 502);
  }
});

/** De novo a cada 3 dias: a pessoa pode trocar a foto */
const AVATAR_TTL = 3 * 24 * 3600_000;

/** Fotos de perfil das conversas: pede ao servidor, guarda uma cópia (o link do WhatsApp expira) e grava na conversa */
async function syncAvatars(call: (path: string, init?: RequestInit) => Promise<Response>, ids: string[]) {
  if (!ids.length) return { updated: {} };
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: convs, error } = await admin.from('wa_conversations')
    .select('id, session_id, contact_phone, avatar_checked_at').in('id', ids);
  if (error) return { error: error.message, updated: {} };
  const due = (convs ?? []).filter((c: any) => !c.avatar_checked_at || Date.now() - new Date(c.avatar_checked_at).getTime() > AVATAR_TTL);
  const updated: Record<string, string | null> = {};

  const bySession = new Map<string, any[]>();
  for (const c of due) bySession.set(c.session_id, [...(bySession.get(c.session_id) ?? []), c]);
  for (const [session, list] of bySession) {
    const res = await call('/avatars', { method: 'POST', body: JSON.stringify({ session, to: list.map((c) => c.contact_phone) }) });
    if (!res.ok) continue; // número desconectado: tenta de novo depois, sem marcar como verificado
    const { photos = {} } = await res.json().catch(() => ({}));
    for (const c of list) {
      let avatar: string | null = null;
      const url = photos[c.contact_phone];
      if (url) {
        try {
          const img = await fetch(url);
          if (img.ok) {
            const path = `${session}/${c.contact_phone.replace(/[^\w.-]/g, '_')}.jpg`;
            const up = await admin.storage.from('wa-avatars')
              .upload(path, await img.arrayBuffer(), { contentType: img.headers.get('content-type') ?? 'image/jpeg', upsert: true });
            // ?v= para o navegador não mostrar a foto antiga do cache
            if (!up.error) avatar = `${admin.storage.from('wa-avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
          }
        } catch { /* sem foto desta vez */ }
      }
      await admin.from('wa_conversations').update({ contact_avatar: avatar, avatar_checked_at: new Date().toISOString() }).eq('id', c.id);
      updated[c.id] = avatar;
    }
  }
  return { updated };
}
