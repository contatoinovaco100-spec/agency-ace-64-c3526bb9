// Fluxos de chatbot do WhatsApp (Comercial → Fluxos do WhatsApp).
// wa-inbound chama flowsOnInbound a cada mensagem recebida (dispara o gatilho ou segue quem está esperando resposta);
// wa-automations chama runDueFlows a cada rodada do cron (fim das esperas e de quem não respondeu a tempo).
// deno-lint-ignore-file no-explicit-any
import { createLead, findLeadByPhone, recordMessage, upsertConversation } from "./crm.ts";

export type FlowStep = {
  id: string;
  type: "text" | "image" | "video" | "audio" | "document" | "delay" | "wait_reply" | "move_stage" | "notify" | "stop_followup" | "end";
  text?: string; url?: string; caption?: string; fileName?: string;
  amount?: number; unit?: "segundos" | "minutos" | "horas" | "dias";
  branches?: { id: string; label: string; keywords: string; steps: FlowStep[] }[];
  other?: FlowStep[]; timeout?: FlowStep[];
  stage?: string; phone?: string;
};
type Run = { id: string; flow_id: string; phone: string; session_id: string; lead_id: string | null; contact_name: string; status: string; current_step: string | null; history: unknown[] };

const UNIT_MS = { segundos: 1000, minutos: 60_000, horas: 3_600_000, dias: 86_400_000 } as const;
const INLINE_MAX_MS = 45_000; // esperas curtas rodam na hora; as maiores ficam para o cron
const NO_TIMEOUT_MS = 30 * 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const durationMs = (s: FlowStep) => Math.max(Number(s.amount) || 0, 0) * (UNIT_MS[s.unit ?? "minutos"] ?? 60_000);
export const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const keywordsOf = (raw: string | undefined) => String(raw ?? "").split(",").map(normalize).filter(Boolean);

/** Onde cada passo está: a lista que o contém e o passo "esperar resposta" do qual é um caminho */
function indexSteps(steps: FlowStep[], parent: string | null = null, map = new Map<string, { list: FlowStep[]; i: number; parent: string | null }>()) {
  steps.forEach((s, i) => {
    map.set(s.id, { list: steps, i, parent });
    if (s.type === "wait_reply") {
      for (const b of s.branches ?? []) indexSteps(b.steps ?? [], s.id, map);
      indexSteps(s.other ?? [], s.id, map);
      indexSteps(s.timeout ?? [], s.id, map);
    }
  });
  return map;
}

/** Próximo passo depois deste: o seguinte da mesma lista. "Esperar resposta" é sempre o último da lista
 *  (o fluxo segue dentro dos caminhos), então o fim de um caminho é o fim do fluxo. */
function nextAfter(map: ReturnType<typeof indexSteps>, id: string): string | null {
  const at = map.get(id);
  return at?.list[at.i + 1]?.id ?? null;
}

async function waFetch(path: string, body: unknown) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) throw new Error("WA_SERVER_URL não configurado");
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300));
  return (await res.json().catch(() => ({}))) as { messageId?: string; session?: string };
}

function render(text: string, run: Run, lead: any) {
  const vars: Record<string, string> = {
    nome: String(lead?.name || run.contact_name || "").trim().split(/\s+/)[0] ?? "",
    empresa: String(lead?.company ?? ""), telefone: run.phone,
  };
  return String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Manda texto ou mídia (foto, vídeo, áudio, arquivo) e grava na conversa do CRM */
async function sendStep(admin: any, run: Run, s: FlowStep, lead: any) {
  const media = s.type === "text" ? null : { type: s.type, url: s.url, caption: render(s.caption ?? "", run, lead), fileName: s.fileName || undefined };
  if (media && !media.url) throw new Error(`Passo de ${s.type} sem arquivo`);
  const text = s.type === "text" ? render(s.text ?? "", run, lead) : media!.caption;
  if (!text && !media) return;
  await waFetch("/presence", { to: run.phone, session: run.session_id, state: s.type === "audio" ? "recording" : "composing" }).catch(() => null);
  await sleep(1200);
  // Servidor sem suporte a mídia ainda: manda a legenda ou o link
  const r = await waFetch("/send", { to: run.phone, session: run.session_id, message: text || media?.url, media });
  const conv = await upsertConversation(admin, r.session ?? run.session_id, run.phone, run.contact_name);
  if (conv) {
    const label = { image: "[imagem]", video: "[vídeo]", audio: "[áudio]", document: `[${s.fileName || "arquivo"}]` }[s.type as "image"];
    await recordMessage(admin, conv, { direction: "out", type: s.type, content: text || label || "", wa_message_id: r.messageId ?? null });
  }
}

async function leadFor(admin: any, run: Run) {
  if (run.lead_id) {
    const { data } = await admin.from("leads").select("id, name, company, stage, owner_id").eq("id", run.lead_id).maybeSingle();
    if (data) return data;
  }
  return await findLeadByPhone(admin, run.phone);
}

/** Executa a partir do passo indicado até uma espera, um "esperar resposta" ou o fim do fluxo */
async function execute(admin: any, run: Run, flow: any, startId: string | null) {
  const map = indexSteps((flow.steps ?? []) as FlowStep[]);
  const history = [...(run.history ?? [])].slice(-80);
  const save = (patch: Record<string, unknown>) =>
    admin.from("wa_flow_runs").update({ ...patch, history, updated_at: new Date().toISOString() }).eq("id", run.id);
  let lead = await leadFor(admin, run);
  let id = startId;
  try {
    for (let guard = 0; id && guard < 60; guard++) {
      const at = map.get(id);
      if (!at) break; // passo apagado no editor depois que o contato entrou
      const s = at.list[at.i];
      history.push({ step: s.id, type: s.type, at: new Date().toISOString() });
      if (s.type === "end") break;
      if (s.type === "delay") {
        const ms = durationMs(s);
        const next = nextAfter(map, s.id);
        if (ms <= INLINE_MAX_MS) { await sleep(ms); id = next; continue; }
        if (!next) break;
        return await save({ status: "ativo", current_step: next, next_at: new Date(Date.now() + ms).toISOString() });
      }
      if (s.type === "wait_reply") {
        const ms = durationMs(s) || NO_TIMEOUT_MS;
        return await save({ status: "aguardando", current_step: s.id, next_at: new Date(Date.now() + ms).toISOString() });
      }
      if (s.type === "move_stage" && s.stage) {
        if (lead) await admin.from("leads").update({ stage: s.stage }).eq("id", lead.id);
        else {
          lead = await createLead(admin, { name: run.contact_name || run.phone, phone: run.phone, source: "WhatsApp (fluxo)", session: run.session_id, stage: s.stage, autoEnroll: false } as any);
        }
        if (lead && lead.id !== run.lead_id) { run.lead_id = lead.id; await save({ lead_id: lead.id }); }
      } else if (s.type === "stop_followup") {
        if (lead) await admin.from("crm_enrollments").update({ status: "parado", last_error: "Parado pelo fluxo", updated_at: new Date().toISOString() }).eq("lead_id", lead.id).eq("status", "ativo");
      } else if (s.type === "notify") {
        const to = String(s.phone ?? "").trim();
        if (to) await waFetch("/send", { to, session: run.session_id, message: render(s.text ?? "", run, lead) + `\n\nContato: ${run.contact_name || ""} +${run.phone}` });
      } else {
        await sendStep(admin, run, s, lead);
      }
      id = nextAfter(map, s.id);
    }
    await save({ status: "concluido", current_step: null });
  } catch (e) {
    await save({ status: "erro", current_step: id, last_error: String((e as Error).message).slice(0, 300) });
  }
}

/** Pega o contato para esta rodada (outra chamada no mesmo instante não executa de novo) */
async function claim(admin: any, run: Run) {
  const { data } = await admin.from("wa_flow_runs").update({ status: "executando", updated_at: new Date().toISOString() })
    .eq("id", run.id).eq("status", run.status).select("id");
  return !!data?.length;
}

/** Começa o fluxo para um contato (gatilho ou teste) */
export async function startFlow(admin: any, flow: any, c: { phone: string; session: string; name: string; leadId: string | null }) {
  const { data: run, error } = await admin.from("wa_flow_runs").insert({
    flow_id: flow.id, phone: c.phone, session_id: c.session, lead_id: c.leadId, contact_name: c.name, status: "executando",
  }).select("*").single();
  if (error || !run) throw new Error(error?.message ?? "Não foi possível iniciar o fluxo");
  await execute(admin, run, flow, (flow.steps ?? [])[0]?.id ?? null);
  return run.id as string;
}

/** Posição da palavra-chave na mensagem (palavra inteira), ou -1 */
function findKeyword(text: string, kw: string) {
  const m = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`).exec(text);
  return m ? m.index + m[1].length : -1;
}

/** Caminho escolhido pela resposta do contato: o da palavra-chave que aparece primeiro na mensagem
 *  ("não quero" vai para "Não" mesmo que "quero" esteja no "Sim"); sem nenhuma, "qualquer outra resposta" */
function pickBranch(s: FlowStep, text: string) {
  const t = normalize(text);
  let best: { pos: number; len: number; branch: NonNullable<FlowStep["branches"]>[number] } | null = null;
  for (const b of s.branches ?? []) {
    for (const k of keywordsOf(b.keywords)) {
      const pos = findKeyword(t, k);
      if (pos >= 0 && (!best || pos < best.pos || (pos === best.pos && k.length > best.len))) best = { pos, len: k.length, branch: b };
    }
  }
  return best ? best.branch.steps?.[0]?.id ?? null : s.other?.[0]?.id ?? null;
}

function triggerMatches(flow: any, text: string, facts: { firstReply: boolean; newContact: boolean }) {
  if (flow.trigger === "first_reply") return facts.firstReply;
  if (flow.trigger === "new_contact") return facts.newContact;
  if (flow.trigger === "keyword") {
    const t = normalize(text);
    const kws = keywordsOf(flow.trigger_config?.keywords);
    return flow.trigger_config?.match === "exact" ? kws.includes(t) : kws.some((k) => findKeyword(t, k) >= 0);
  }
  return false;
}

/** Mensagem recebida numa conversa individual: segue o fluxo que espera a resposta ou dispara um gatilho.
 *  O telefone é comparado pelos últimos 8 dígitos (o WhatsApp às vezes manda sem o 9 do celular). */
export async function flowsOnInbound(admin: any, m: { session: string; phone: string; name: string; text: string; conversationId: string; leadId: string | null }) {
  const { data: open } = await admin.from("wa_flow_runs").select("*, wa_flows(*)")
    .like("phone", `%${m.phone.slice(-8)}`).in("status", ["aguardando", "ativo", "executando"]).order("created_at", { ascending: false }).limit(1);
  const current = open?.[0];
  if (current) {
    // Uma conversa anda em um fluxo por vez; quem está numa espera de tempo não muda de caminho ao escrever
    if (current.status !== "aguardando" || !current.wa_flows) return;
    const map = indexSteps(current.wa_flows.steps ?? []);
    const at = map.get(current.current_step);
    if (!at) return;
    if (!(await claim(admin, current))) return;
    const next = pickBranch(at.list[at.i], m.text);
    current.history = [...(current.history ?? []), { reply: m.text.slice(0, 200), at: new Date().toISOString() }];
    return await execute(admin, current, current.wa_flows, next);
  }

  const { data: flows } = await admin.from("wa_flows").select("*").eq("enabled", true).order("created_at");
  const candidates = (flows ?? []).filter((f: any) => !f.session_id || f.session_id === m.session);
  if (!candidates.length) return;
  // Primeira resposta / contato novo: esta é a única mensagem recebida da conversa
  const count = async (direction: string) => (await admin.from("wa_messages").select("id", { count: "exact", head: true })
    .eq("conversation_id", m.conversationId).eq("direction", direction)).count ?? 0;
  const inbound = await count("in");
  const outbound = inbound === 1 ? await count("out") : 0;
  const facts = { firstReply: inbound === 1 && outbound > 0, newContact: inbound === 1 && outbound === 0 };
  for (const flow of candidates) {
    if (!triggerMatches(flow, m.text, facts)) continue;
    // "Só uma vez por contato" (padrão): quem já passou por este fluxo não entra de novo
    if (flow.trigger_config?.once !== false) {
      const { count: already } = await admin.from("wa_flow_runs").select("id", { count: "exact", head: true }).eq("flow_id", flow.id).like("phone", `%${m.phone.slice(-8)}`);
      if (already) continue;
    }
    await startFlow(admin, flow, { phone: m.phone, session: m.session, name: m.name, leadId: m.leadId });
    return;
  }
}

/** Rodada do cron: fim das esperas de tempo e de quem não respondeu dentro do prazo */
export async function runDueFlows(admin: any) {
  const { data: due } = await admin.from("wa_flow_runs").select("*, wa_flows(*)")
    .in("status", ["ativo", "aguardando"]).lte("next_at", new Date().toISOString()).order("next_at").limit(30);
  let done = 0;
  for (const run of due ?? []) {
    if (!run.wa_flows) { await admin.from("wa_flow_runs").update({ status: "parado", last_error: "Fluxo removido" }).eq("id", run.id); continue; }
    if (!run.wa_flows.enabled) continue;
    if (!(await claim(admin, run))) continue;
    let start: string | null = run.current_step;
    if (run.status === "aguardando") {
      // Sem resposta no prazo: caminho "não respondeu" (vazio = encerra)
      const map = indexSteps(run.wa_flows.steps ?? []);
      const at = map.get(run.current_step);
      start = at ? at.list[at.i].timeout?.[0]?.id ?? null : null;
      run.history = [...(run.history ?? []), { timeout: true, at: new Date().toISOString() }];
    }
    await execute(admin, run, run.wa_flows, start);
    done++;
  }
  return done;
}
