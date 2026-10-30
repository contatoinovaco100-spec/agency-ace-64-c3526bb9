// Regras do CRM compartilhadas pelas funções (wa-inbound, wa-server, crm-capture, wa-automations):
// achar lead pelo telefone, distribuir entre vendedores, criar lead, registrar conversa e mensagem.
// deno-lint-ignore-file no-explicit-any

/** Só dígitos, com DDI 55 quando vier sem */
export function normalizePhone(raw: string | null | undefined) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

/** Chave do telefone para achar repetidos: DDD + últimos 8 dígitos (ignora 55 e o 9 a mais do celular) */
export function phoneKey(raw: string | null | undefined) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

/** Lead com esse telefone (compara os 8 últimos dígitos: ignora DDI, DDD com/sem 9) */
export async function findLeadByPhone(admin: any, phone: string) {
  const tail = phone.slice(-8);
  const { data } = await admin.from("leads").select("id, name, company, assignee, owner_id, whatsapp_session, stage")
    .or(`phone.ilike.%${tail}%,telefone.ilike.%${tail}%`).limit(1);
  return data?.[0] ?? null;
}

export async function findClientByPhone(admin: any, phone: string) {
  const { data } = await admin.from("clients").select("id").ilike("phone", `%${phone.slice(-8)}%`).is("deleted_at", null).limit(1);
  return data?.[0]?.id ?? null;
}

/** Próximo vendedor do rodízio (o que recebeu lead há mais tempo) */
export async function pickSeller(admin: any): Promise<{ id: string; full_name: string } | null> {
  const { data: sellers } = await admin.from("crm_sellers").select("profile_id, last_assigned_at").eq("active", true)
    .order("last_assigned_at", { ascending: true, nullsFirst: true }).limit(1);
  const next = sellers?.[0];
  if (!next) return null;
  await admin.from("crm_sellers").update({ last_assigned_at: new Date().toISOString() }).eq("profile_id", next.profile_id);
  const { data: p } = await admin.from("profiles").select("id, full_name").eq("id", next.profile_id).maybeSingle();
  return p ?? null;
}

async function firstStage(admin: any) {
  const { data } = await admin.from("kanban_stages").select("name").eq("board", "crm").order("position").limit(1);
  return data?.[0]?.name ?? "Lead novo";
}

/** Etapa de primeiro contato do CRM ("Primeiro contato" ou "Contato iniciado"; senão a segunda etapa) */
export async function firstContactStage(admin: any) {
  const { data } = await admin.from("kanban_stages").select("name").eq("board", "crm").order("position");
  const stages = (data ?? []) as { name: string }[];
  return stages.find((s) => /primeiro contato|contato iniciado/i.test(s.name))?.name ?? stages[1]?.name ?? stages[0]?.name ?? "Contato iniciado";
}

/** Nome da primeira etapa do CRM (onde entra o lead novo) */
export async function newLeadStage(admin: any) {
  return await firstStage(admin);
}

/** Etapa de perdido do CRM (quem pediu para não receber mais mensagens) */
export async function lostStage(admin: any) {
  const { data } = await admin.from("kanban_stages").select("name").eq("board", "crm").order("position");
  return ((data ?? []) as { name: string }[]).find((s) => /perdid/i.test(s.name))?.name ?? null;
}

/** Cria o lead, define o dono (o dono do número ou o rodízio) e inscreve nas sequências automáticas */
export async function createLead(admin: any, input: {
  name: string; phone: string | null; company?: string; email?: string; source: string; notes?: string;
  owner?: { id: string; full_name: string } | null; session?: string | null; stage?: string;
  /** false = não entra nas sequências automáticas de lead novo (ex.: empresa abordada pela prospecção) */
  autoEnroll?: boolean;
}) {
  const owner = input.owner ?? await pickSeller(admin);
  const { data: lead, error } = await admin.from("leads").insert({
    name: input.name || input.phone || "Lead", company: input.company ?? "", email: input.email ?? "",
    phone: input.phone ?? "", source: input.source, notes: input.notes ?? "", stage: input.stage ?? await firstStage(admin),
    assignee: owner?.full_name ?? "", closer: "", estimated_value: 0,
    owner_id: owner?.id ?? null, whatsapp_session: input.session ?? null,
  }).select("id, name, company, assignee, owner_id, whatsapp_session").single();
  if (error) throw new Error(error.message);

  if (input.autoEnroll !== false) {
    const { data: seqs } = await admin.from("crm_sequences").select("id, steps").eq("active", true).eq("auto_enroll_new", true);
    for (const s of seqs ?? []) await enroll(admin, lead.id, s, input.session ?? null);
  }
  return lead;
}

/** Inscreve o lead numa sequência (o primeiro passo sai no próximo horário permitido) */
export async function enroll(admin: any, leadId: string, seq: { id: string; steps: { day: number }[] }, session: string | null, createdBy?: string | null) {
  const first = Number(seq.steps?.[0]?.day ?? 0);
  await admin.from("crm_enrollments").insert({
    lead_id: leadId, sequence_id: seq.id, step_index: 0, session_id: session,
    next_at: new Date(Date.now() + first * 86_400_000).toISOString(), created_by: createdBy ?? null,
  });
}

/** Conversa do contato naquele número (cria se não existir) */
export async function upsertConversation(admin: any, session: string, phone: string, name: string) {
  const { data: existing } = await admin.from("wa_conversations").select("*").eq("session_id", session).eq("contact_phone", phone).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("wa_conversations").insert({
    session_id: session, contact_phone: phone, contact_name: name || phone, last_message: "", unread_count: 0,
  }).select("*").single();
  if (error) {
    // Corrida com outra mensagem do mesmo contato: busca de novo
    const { data: again } = await admin.from("wa_conversations").select("*").eq("session_id", session).eq("contact_phone", phone).maybeSingle();
    return again;
  }
  return data;
}

/** Grava a mensagem e atualiza a conversa (última mensagem, não lidas) */
export async function recordMessage(admin: any, conv: any, msg: {
  direction: "in" | "out"; content: string; type?: string; wa_message_id?: string | null; status?: string; at?: string;
}) {
  const at = msg.at ?? new Date().toISOString();
  const type = ["text", "image", "audio", "video", "document", "sticker", "location"].includes(msg.type ?? "") ? msg.type : "text";
  const { error } = await admin.from("wa_messages").insert({
    conversation_id: conv.id, wa_message_id: msg.wa_message_id ?? null, direction: msg.direction, type,
    content: msg.content, status: msg.status ?? (msg.direction === "in" ? "received" : "sent"), created_at: at,
  });
  // Mensagem repetida (o servidor reenviou): não conta de novo
  if (error) return false;
  await admin.from("wa_conversations").update({
    last_message: msg.content.slice(0, 300), last_message_at: at, updated_at: new Date().toISOString(),
    unread_count: msg.direction === "in" ? (conv.unread_count ?? 0) + 1 : conv.unread_count ?? 0,
  }).eq("id", conv.id);
  return true;
}
