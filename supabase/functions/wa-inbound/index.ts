// Recebe do servidor WhatsApp cada mensagem individual (recebida ou enviada pelo celular) e grava no CRM:
// conversa do número + contato, vínculo com lead/cliente, captura de lead novo e parada do follow-up
// quando o lead responde. Autenticado pela mesma chave do servidor (WA_API_KEY).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createLead, findClientByPhone, findLeadByPhone, normalizePhone, recordMessage, upsertConversation,
} from "../_shared/crm.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.headers.get("x-api-key") !== Deno.env.get("WA_API_KEY")) return json({ error: "Chave inválida" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const m = await req.json();
    const session = String(m.session || "default");
    const phone = normalizePhone(m.phone);
    if (!phone) return json({ ok: true, skipped: "telefone inválido" });
    const fromMe = !!m.fromMe;
    const at = new Date((Number(m.timestamp) || Date.now() / 1000) * 1000).toISOString();

    // Nome: o do perfil (quem escreveu) ou o da agenda do celular (vem também nas mensagens enviadas)
    const name = String((fromMe ? m.contactName : m.name || m.contactName) || "");
    const conv = await upsertConversation(admin, session, phone, name);
    if (!conv) return json({ error: "Não foi possível abrir a conversa" }, 500);
    const isNew = await recordMessage(admin, conv, {
      direction: fromMe ? "out" : "in", content: String(m.text || ""), type: m.type, wa_message_id: m.id, at,
    });
    if (!isNew) return json({ ok: true, duplicate: true });

    // Nome do contato (o que ele mesmo usa no WhatsApp) e vínculos com lead/cliente
    const patch: Record<string, unknown> = {};
    if (name && (!conv.contact_name || conv.contact_name === conv.contact_phone)) patch.contact_name = name;
    if (!conv.client_id) { const clientId = await findClientByPhone(admin, phone); if (clientId) patch.client_id = clientId; }

    let leadId = conv.lead_id as string | null;
    if (!leadId) {
      const lead = await findLeadByPhone(admin, phone);
      leadId = lead?.id ?? null;
      // Contato novo escrevendo para um número que captura leads (e que não é cliente): vira lead
      if (!leadId && !fromMe && !patch.client_id && !conv.client_id) {
        const { data: num } = await admin.from("wa_numbers").select("kind, owner_id, capture_leads").eq("id", session).maybeSingle();
        if (num?.capture_leads) {
          const owner = num.kind === "vendedor" && num.owner_id
            ? (await admin.from("profiles").select("id, full_name").eq("id", num.owner_id).maybeSingle()).data
            : null;
          const created = await createLead(admin, {
            name: name || phone, phone, source: "WhatsApp", owner, session,
            notes: `Primeira mensagem: ${String(m.text || "").slice(0, 300)}`,
          });
          leadId = created.id;
        }
      }
      if (leadId) patch.lead_id = leadId;
    }
    if (Object.keys(patch).length) await admin.from("wa_conversations").update(patch).eq("id", conv.id);

    if (leadId) {
      await admin.from("leads").update(fromMe ? { last_outbound_at: at } : { last_inbound_at: at, contacted: true }).eq("id", leadId);
      // Lead respondeu: para as sequências que param na resposta
      if (!fromMe) {
        const { data: active } = await admin.from("crm_enrollments").select("id, crm_sequences(stop_on_reply)").eq("lead_id", leadId).eq("status", "ativo");
        const stop = (active ?? []).filter((e: { crm_sequences?: { stop_on_reply?: boolean } }) => e.crm_sequences?.stop_on_reply !== false).map((e: { id: string }) => e.id);
        if (stop.length) await admin.from("crm_enrollments").update({ status: "respondeu", updated_at: new Date().toISOString() }).in("id", stop);
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error("wa-inbound error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
