// Prospecção automática pelo WhatsApp.
// - action "search" (login): busca empresas da campanha no Google (Places API oficial) e coloca na fila.
// - action "sample" (login): mostra como fica a mensagem da campanha para uma empresa, sem enviar.
// - action "start" (login): liga a campanha e envia a primeira mensagem na hora.
// - action "run" (cron a cada minuto, sem login): para cada campanha ligada, no horário e dentro do limite do dia,
//   envia a mensagem da campanha (a que você escreveu): "um_por_vez" (1 mensagem e intervalo de minutos) ou
//   "lotes" (N mensagens pelo servidor do WhatsApp com intervalo de segundos, depois pausa de X minutos).
// - action "bulk_result" / "bulk_done" (servidor do WhatsApp, com a chave dele): resultado de cada envio do lote e fim do lote.
// A resposta do prospect é tratada no wa-inbound (vira lead, ou "não quer" se pedir para parar).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { createLead, findClientByPhone, findLeadByPhone, firstContactStage, normalizePhone, phoneKey, recordMessage, upsertConversation } from "../_shared/crm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Campaign = {
  id: string; name: string; niche: string; city: string; session_id: string | null; pitch: string; example_message: string;
  daily_limit: number; min_gap_min: number; max_gap_min: number; start_hour: number; end_hour: number;
  weekdays_only: boolean; active: boolean; next_send_at: string | null;
  send_mode?: "um_por_vez" | "lotes"; batch_size?: number; batch_min_sec?: number; batch_max_sec?: number; batch_pause_min?: number;
  batch_running_since?: string | null;
};
type Prospect = { id: string; name: string; phone: string; message?: string; status?: string; sent_at?: string | null; lead_id?: string | null; campaign_id?: string; address: string; category: string; rating: number | null; reviews: number | null; website: string };

const spNow = () => new Date(Date.now() - 3 * 3_600_000);
const spDayStartUtc = () => new Date(spNow().toISOString().slice(0, 10) + "T03:00:00Z").toISOString();

// ─── Google Places (Text Search, API nova) ───────────────────────────────────
const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.rating", "places.userRatingCount", "places.websiteUri", "places.googleMapsUri", "places.primaryTypeDisplayName",
  "places.businessStatus", "nextPageToken",
].join(",");

async function searchPlaces(query: string, pages = 3) {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("Cadastre o segredo GOOGLE_PLACES_API_KEY no Lovable");
  const places: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < pages; i++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, pageToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google: ${data?.error?.message ?? res.status}`);
    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 1500)); // o Google pede um intervalo antes de usar o token
  }
  return places;
}

// ─── Mensagem da campanha (escrita por você) ─────────────────────────────────
/** Troca {empresa}, {nicho} e {cidade} e sorteia variações {Oi|Olá|Bom dia} (cada empresa recebe uma combinação) */
function renderMessage(c: Campaign, p: Pick<Prospect, "name" | "category">) {
  const text = String(c.example_message ?? "").trim();
  if (!text) throw new Error("Escreva a mensagem da campanha em Editar");
  const vars: Record<string, string> = { empresa: p.name, nicho: p.category || c.niche, cidade: c.city };
  return text
    .replace(/\{(empresa|nicho|cidade)\}/gi, (_, k: string) => vars[k.toLowerCase()] ?? "")
    .replace(/\{([^{}]*\|[^{}]*)\}/g, (_, opts: string) => { const o = opts.split("|"); return o[Math.floor(Math.random() * o.length)].trim(); });
}

// ─── Servidor do WhatsApp ────────────────────────────────────────────────────
async function wa(path: string, body: unknown) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) throw new Error("WA_SERVER_URL não configurado");
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Servidor do WhatsApp: ${res.status}`);
  return data;
}

/** Já é cliente, lead ou já conversou com a gente: não prospecta */
const SENT_STATUSES = ["enviando", "enviado", "respondeu", "nao_quer"];

/** Já recebeu mensagem (em qualquer campanha, mesmo com o número escrito diferente), é cliente, lead ou já conversou */
async function alreadyKnown(admin: any, phone: string, prospectId?: string) {
  const key = phoneKey(phone);
  const tail = phone.slice(-8);
  const { data: sent } = await admin.from("prospects").select("id, phone").ilike("phone", `%${tail}`).in("status", SENT_STATUSES);
  if ((sent ?? []).some((x: { id: string; phone: string }) => x.id !== prospectId && phoneKey(x.phone) === key)) return "já recebeu mensagem da prospecção";
  if (await findClientByPhone(admin, phone)) return "já é cliente";
  if (await findLeadByPhone(admin, phone)) return "já é lead";
  const { data: convs } = await admin.from("wa_conversations").select("contact_phone").ilike("contact_phone", `%${tail}`);
  return (convs ?? []).some((x: { contact_phone: string }) => phoneKey(x.contact_phone) === key) ? "já conversou no WhatsApp" : null;
}

/** Empresa abordada vira lead no CRM: "Lead novo" ao enviar, "Contato iniciado" se já respondeu */
async function leadForProspect(admin: any, c: Pick<Campaign, "name">, p: Prospect, phone: string, session: string | null, message: string) {
  const lead = await createLead(admin, {
    name: p.name, company: p.name, phone, source: "Prospecção", session, autoEnroll: false,
    stage: p.status === "respondeu" ? await firstContactStage(admin) : undefined,
    notes: `Nicho: ${p.category || "-"}\nCampanha: ${c.name}\nMensagem enviada: ${message.slice(0, 500)}`,
  });
  await admin.from("prospects").update({ lead_id: lead.id }).eq("id", p.id);
  return lead.id as string;
}

/** Empresas que já receberam mensagem antes desta versão e ainda não estão no CRM */
async function backfillLeads(admin: any) {
  const { data } = await admin.from("prospects").select("*, prospect_campaigns(name, session_id)")
    .in("status", ["enviado", "respondeu"]).is("lead_id", null).not("campaign_id", "is", null).limit(20);
  for (const p of data ?? []) {
    try {
      const known = await findLeadByPhone(admin, p.phone);
      if (known) { await admin.from("prospects").update({ lead_id: known.id }).eq("id", p.id); continue; }
      await leadForProspect(admin, { name: p.prospect_campaigns?.name ?? "" }, p, p.phone, p.prospect_campaigns?.session_id ?? null, p.message || "");
    } catch (e) { console.error("backfill lead", p.id, e); }
  }
}

/** Depois de enviar: marca a empresa, cria o lead em "Lead novo" e registra a mensagem na conversa */
async function afterSent(admin: any, c: Pick<Campaign, "name">, p: Prospect, waNumber: string, message: string, session: string, messageId: string | null) {
  await admin.from("prospects").update({ status: "enviado", message, sent_at: new Date().toISOString(), error: "" }).eq("id", p.id);
  const phone = normalizePhone(waNumber) ?? p.phone;
  const leadId = await leadForProspect(admin, c, p, phone, session, message).catch((e) => { console.error("lead da prospecção", e); return null; });
  const conv = await upsertConversation(admin, session, phone, p.name);
  if (conv) {
    await recordMessage(admin, conv, { direction: "out", content: message, wa_message_id: messageId });
    if (leadId && !conv.lead_id) await admin.from("wa_conversations").update({ lead_id: leadId }).eq("id", conv.id);
  }
}

// ─── Envio em lotes: N mensagens pelo servidor (intervalo de segundos), depois pausa ─
async function runBatch(admin: any, c: Campaign, remainingToday: number) {
  const size = Math.max(1, Math.min(c.batch_size ?? 20, remainingToday, 100));
  // Separa as próximas da fila, pulando quem já é cliente/lead/conversa
  const { data: queue } = await admin.from("prospects").select("*").eq("campaign_id", c.id).eq("status", "novo").order("created_at").limit(size * 2);
  if (!queue?.length) return { skipped: "fila vazia" };
  const batch: Prospect[] = [];
  const keys = new Set<string>();
  for (const p of queue as Prospect[]) {
    if (batch.length >= size) break;
    // O mesmo número duas vezes no mesmo lote (escrito diferente): só o primeiro
    const key = phoneKey(p.phone) ?? p.phone;
    if (keys.has(key)) { await admin.from("prospects").update({ status: "descartado", error: "número repetido no lote" }).eq("id", p.id); continue; }
    keys.add(key);
    const known = await alreadyKnown(admin, p.phone, p.id);
    if (known) { await admin.from("prospects").update({ status: "descartado", error: known }).eq("id", p.id); continue; }
    batch.push(p);
  }
  if (!batch.length) return { skipped: "fila vazia" };

  const items = batch.map((p) => ({ ref: p.id, to: p.phone, message: renderMessage(c, p) }));
  const now = new Date().toISOString();
  // Trava a campanha até o servidor avisar que o lote terminou (no máximo 1 hora, se o aviso se perder)
  await admin.from("prospect_campaigns").update({ batch_running_since: now, next_send_at: new Date(Date.now() + 60 * 60_000).toISOString() }).eq("id", c.id);
  for (const it of items) await admin.from("prospects").update({ status: "enviando", message: it.message, updated_at: now }).eq("id", it.ref);
  try {
    await wa("/bulk", { session: c.session_id || undefined, campaign: c.id, items, minSec: c.batch_min_sec ?? 8, maxSec: c.batch_max_sec ?? 20 });
  } catch (e) {
    // Servidor recusou: devolve para a fila e tenta de novo daqui a pouco
    await admin.from("prospects").update({ status: "novo" }).in("id", items.map((i) => i.ref));
    await admin.from("prospect_campaigns").update({ batch_running_since: null, next_send_at: new Date(Date.now() + 2 * 60_000).toISOString() }).eq("id", c.id);
    return { error: (e as Error).message };
  }
  return { batch: items.length };
}

/** Lote que ficou preso (o aviso do servidor se perdeu): não reenvia — a mensagem pode ter saído */
async function releaseStuck(admin: any) {
  const old = new Date(Date.now() - 45 * 60_000).toISOString();
  await admin.from("prospects").update({ status: "erro", error: "Envio não confirmado pelo servidor: confira a conversa antes de reenviar" })
    .eq("status", "enviando").lt("updated_at", old);
  await admin.from("prospect_campaigns").update({ batch_running_since: null }).lt("batch_running_since", old);
}

// ─── Envio: 1 mensagem por campanha a cada rodada, respeitando horário, limite e intervalo ─
async function runCampaign(admin: any, c: Campaign) {
  const now = spNow();
  const dow = now.getUTCDay(), hour = now.getUTCHours();
  if (c.weekdays_only && (dow === 0 || dow === 6)) return { skipped: "fim de semana" };
  if (hour < c.start_hour || hour >= c.end_hour) return { skipped: "fora do horário" };
  if (c.batch_running_since) return { skipped: "lote em andamento" };
  if (c.next_send_at && new Date(c.next_send_at) > new Date()) return { skipped: "aguardando intervalo" };
  if (!String(c.example_message ?? "").trim()) return { skipped: "sem mensagem" };

  const { count } = await admin.from("prospects").select("id", { count: "exact", head: true })
    .eq("campaign_id", c.id).gte("sent_at", spDayStartUtc());
  if ((count ?? 0) >= c.daily_limit) return { skipped: "limite do dia" };
  if (c.send_mode === "lotes") return await runBatch(admin, c, c.daily_limit - (count ?? 0));

  // Marca o próximo horário antes de enviar: se outra rodada chegar no meio, não duplica
  const gap = c.min_gap_min + Math.random() * Math.max(0, c.max_gap_min - c.min_gap_min);
  await admin.from("prospect_campaigns").update({ next_send_at: new Date(Date.now() + gap * 60_000).toISOString() }).eq("id", c.id);

  // Até 5 tentativas na rodada (pula quem não tem WhatsApp ou já é contato)
  const { data: queue } = await admin.from("prospects").select("*").eq("campaign_id", c.id).eq("status", "novo").order("created_at").limit(5);
  if (!queue?.length) return { skipped: "fila vazia" };
  for (const p of queue as Prospect[]) {
    const known = await alreadyKnown(admin, p.phone, p.id);
    if (known) { await admin.from("prospects").update({ status: "descartado", error: known }).eq("id", p.id); continue; }

    const { results } = await wa("/check", { session: c.session_id || undefined, phones: [p.phone] });
    const waNumber = results?.[p.phone];
    if (!waNumber) { await admin.from("prospects").update({ status: "sem_whatsapp" }).eq("id", p.id); continue; }

    try {
      const message = renderMessage(c, p);
      const sent = await wa("/send", { to: waNumber, message, session: c.session_id || undefined, once: true });
      // Mensagem enviada: a empresa entra no CRM em "Lead novo" (quando responder, avança para "Contato iniciado")
      await afterSent(admin, c, p, waNumber, message, sent.session || c.session_id || "default", sent.messageId ?? null);
      return { sent: p.name };
    } catch (e) {
      const msg = String((e as Error).message);
      // O servidor já tinha mandado para esse número antes: só tira da fila
      if (/já recebeu/.test(msg)) { await admin.from("prospects").update({ status: "descartado", error: msg }).eq("id", p.id); continue; }
      await admin.from("prospects").update({ status: "erro", error: msg.slice(0, 300) }).eq("id", p.id);
      return { error: msg };
    }
  }
  return { skipped: "nenhum com WhatsApp nesta rodada" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "run";

    // Avisos do servidor do WhatsApp sobre o lote (autenticados pela chave do servidor)
    if (action === "bulk_result" || action === "bulk_done") {
      if (req.headers.get("x-api-key") !== Deno.env.get("WA_API_KEY")) return json({ error: "Chave inválida" }, 401);
      const { data: camp } = await admin.from("prospect_campaigns").select("*").eq("id", body.campaign).maybeSingle();
      if (action === "bulk_done") {
        const pause = Number(camp?.batch_pause_min ?? 5);
        await admin.from("prospect_campaigns").update({ batch_running_since: null, next_send_at: new Date(Date.now() + pause * 60_000).toISOString() }).eq("id", body.campaign);
        return json({ ok: true });
      }
      const { data: p } = await admin.from("prospects").select("*").eq("id", body.ref).maybeSingle();
      if (!p || !camp) return json({ ok: true, skipped: "não encontrado" });
      if (body.status === "enviado") await afterSent(admin, camp, p, String(body.number || p.phone), p.message, String(body.session || camp.session_id || "default"), body.messageId ?? null);
      else await admin.from("prospects").update({ status: ["sem_whatsapp", "novo", "descartado"].includes(body.status) ? body.status : "erro", error: String(body.error || "") }).eq("id", p.id);
      return json({ ok: true });
    }

    if (action === "run") {
      await releaseStuck(admin);
      await backfillLeads(admin);
      const { data: campaigns } = await admin.from("prospect_campaigns").select("*").eq("active", true);
      const results = [];
      for (const c of (campaigns ?? []) as Campaign[]) results.push({ campaign: c.name, ...(await runCampaign(admin, c)) });
      return json({ ran: results });
    }

    // Busca e exemplo: só para quem está logado na plataforma
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(token);
    if (!user?.user) return json({ error: "Faça login na plataforma" }, 401);

    const { data: campaign } = await admin.from("prospect_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
    const c = { ...(campaign ?? {}), ...(body.draft ?? {}) } as Campaign;

    // Liga a campanha e já envia a primeira mensagem, sem esperar o próximo ciclo do cron
    if (action === "start") {
      if (!campaign) return json({ error: "Campanha não encontrada" }, 404);
      await admin.from("prospect_campaigns").update({ active: true, next_send_at: null, updated_at: new Date().toISOString() }).eq("id", c.id);
      return json(await runCampaign(admin, { ...c, active: true, next_send_at: null }));
    }

    if (action === "sample") {
      const { data: first } = c.id
        ? await admin.from("prospects").select("*").eq("campaign_id", c.id).eq("status", "novo").order("created_at").limit(1).maybeSingle()
        : { data: null };
      const sample = first ?? { name: `${c.niche || "Empresa"} Exemplo`, category: c.niche, address: c.city, rating: 4.7, reviews: 85, website: "" };
      return json({ prospect: sample.name, message: renderMessage(c, sample) });
    }

    if (action === "search") {
      if (!campaign) return json({ error: "Salve a campanha antes de buscar" }, 400);
      if (!String(c.city ?? "").trim()) return json({ error: "Preencha a cidade da campanha em Editar para buscar no Google" }, 400);
      const places = await searchPlaces(`${c.niche} em ${c.city}`);
      let added = 0, noPhone = 0, closed = 0, repeated = 0;
      for (const pl of places) {
        if (pl.businessStatus && pl.businessStatus !== "OPERATIONAL") { closed++; continue; }
        const phone = normalizePhone(pl.internationalPhoneNumber || pl.nationalPhoneNumber);
        if (!phone) { noPhone++; continue; }
        const { error } = await admin.from("prospects").insert({
          campaign_id: c.id, place_id: pl.id, name: pl.displayName?.text ?? "Empresa", phone,
          address: pl.formattedAddress ?? "", category: pl.primaryTypeDisplayName?.text ?? c.niche,
          rating: pl.rating ?? null, reviews: pl.userRatingCount ?? null, website: pl.websiteUri ?? "", maps_url: pl.googleMapsUri ?? "",
        });
        if (error) repeated++; else added++;
      }
      await admin.from("prospect_campaigns").update({ last_search_at: new Date().toISOString() }).eq("id", c.id);
      return json({ found: places.length, added, no_phone: noPhone, closed, repeated });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("prospecting error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
