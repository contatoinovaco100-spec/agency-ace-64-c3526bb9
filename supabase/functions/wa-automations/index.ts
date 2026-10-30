// Motor das Automações do WhatsApp (página /automacoes).
// - action "run" (cron a cada 15 min, sem login): dispara as automações ligadas que chegaram no horário
//   e os disparos manuais agendados.
// - action "preview" (login): monta destinatários e mensagens de uma automação, sem enviar.
// - action "test" (login): envia a mensagem de exemplo para um telefone de teste.
// As mensagens saem pelo servidor WhatsApp da INOVA (WA_SERVER_URL / WA_API_KEY) e ficam em wa_automation_logs.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_URL = Deno.env.get("APP_URL") || "https://inovamarketing.online";
const DAY = 86_400_000;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CLIENT_REVIEW_AUTHOR = "Cliente (link de aprovação)";
const DONE = /postado|publicado|conclu|programado/i;

type Automation = {
  id: string; name: string; trigger: string; enabled: boolean; template: string;
  days_of_week: number[]; send_time: string; params: Record<string, number>;
  audience: { type: "all" | "clients" | "team"; client_ids?: string[]; to?: string };
  destination: "group_then_phone" | "group" | "phone";
  scheduled_at: string | null; sent_at: string | null; last_run_at: string | null; updated_at?: string; created_at?: string;
};
type Client = { id: string; company_name: string; contact_name: string | null; phone: string | null; status: string | null; whatsapp_group_id?: string | null };
/** Um envio a fazer: para quem, com quais variáveis e com qual chave anti-repetição */
type Job = { client: Client | null; to: string | null; vars: Record<string, string>; ref: string };

// ─── Datas no horário de Brasília (UTC-3, sem horário de verão) ──────────────
const spNow = () => new Date(Date.now() - 3 * 3_600_000);
const spDay = (offsetDays = 0) => new Date(spNow().getTime() + offsetDays * DAY).toISOString().slice(0, 10);
const fmtDate = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const firstName = (c: Client) => String(c.contact_name || c.company_name || "").trim().split(/\s+/)[0];
const cleanTitle = (t: { title?: string | null; video_name?: string | null }) =>
  (t.video_name || t.title || "Conteúdo").replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, "");

function phoneOf(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

function recipientFor(c: Client, destination: Automation["destination"]) {
  const group = String(c.whatsapp_group_id ?? "").trim() || null;
  const phone = phoneOf(c.phone);
  if (destination === "group") return group;
  if (destination === "phone") return phone;
  return group || phone;
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function clientVars(c: Client): Record<string, string> {
  return {
    nome: firstName(c), empresa: c.company_name ?? "",
    link_aprovacao: `${APP_URL}/conteudo/${c.id}`, link_relatorio: `${APP_URL}/relatorio/${c.id}`, link_portal: `${APP_URL}/portal/${c.id}`,
  };
}

/** Gatilhos de evento: rodam a cada 15 min dentro da janela de horário e pegam só o que aconteceu desde que a automação foi ligada */
const EVENT_TRIGGERS = new Set([
  "welcome_contract", "change_received", "approved_ack", "payment_confirmed", "invoice_created", "post_published",
  "task_assigned", "sale_closed", "change_request_team", "instagram_disconnected",
]);
/** Gatilhos que mandam para o WhatsApp de cada pessoa da equipe (Equipe → Funcionários) */
const PEOPLE_TRIGGERS = new Set(["task_assigned", "deadline_tomorrow", "lead_stalled", "script_missing", "change_request_team"]);
const ROLE_FIELDS = ["assignee", "copywriter", "editor", "director", "videomaker", "script_writer"] as const;

async function loadPeople(admin: SupabaseClient) {
  const { data } = await admin.from("profiles").select("full_name, whatsapp, is_active");
  const map = new Map<string, { name: string; phone: string | null }>();
  (data ?? []).filter((p) => p.is_active !== false && p.full_name).forEach((p) =>
    map.set(String(p.full_name).trim().toLowerCase(), { name: String(p.full_name).trim().split(/\s+/)[0], phone: phoneOf(p.whatsapp) }));
  return map;
}

const monthsBetween = (from: string, to: string) => {
  const a = new Date(from.slice(0, 10) + "T12:00:00Z"), b = new Date(to + "T12:00:00Z");
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
};

// ─── Gatilhos: cada um devolve a lista de envios ─────────────────────────────
async function buildJobs(admin: SupabaseClient, a: Automation): Promise<Job[]> {
  const p = a.params ?? {};
  const { data: clientRows } = await admin.from("clients").select("*").is("deleted_at", null);
  let clients = ((clientRows ?? []) as Client[]).filter((c) => !c.status || c.status === "Ativo");
  if (a.audience?.type === "clients") clients = clients.filter((c) => a.audience.client_ids?.includes(c.id));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const job = (c: Client, extra: Record<string, string>, ref: string): Job =>
    ({ client: c, to: recipientFor(c, a.destination), vars: { ...clientVars(c), ...extra }, ref });
  // Equipe: grupo/número escolhido na automação
  const teamTo = (() => { const t = String(a.audience?.to ?? "").trim(); return t.includes("@") ? t : phoneOf(t); })();
  const teamJob = (vars: Record<string, string>, ref: string): Job => ({ client: null, to: teamTo, vars, ref });
  // Eventos: só o que aconteceu depois que a automação foi ligada/salva (e nas últimas 24h)
  const since = new Date(Math.max(new Date(a.updated_at ?? a.created_at ?? Date.now()).getTime(), Date.now() - DAY)).toISOString();
  const people = PEOPLE_TRIGGERS.has(a.trigger) ? await loadPeople(admin) : new Map();
  const personJobs = (names: string[], vars: (first: string) => Record<string, string>, ref: string): Job[] =>
    [...new Set(names.map((n) => String(n ?? "").trim().toLowerCase()).filter(Boolean))]
      .map((n) => people.get(n)).filter(Boolean)
      .map((p) => ({ client: null, to: p!.phone, vars: { pessoa: p!.name, ...vars(p!.name) }, ref: `${ref}:${p!.name}` }));
  const taskTitle = (t: { title?: string | null; video_name?: string | null }) => cleanTitle(t);
  const clientName = (id: string | null) => (id && byId.get(id)?.company_name) || "Sem cliente";

  switch (a.trigger) {
    case "approval_pending": {
      const waitDays = p.wait_days ?? 2, gapDays = p.gap_days ?? 3, maxPerItem = p.max_per_item ?? 3;
      const { data: tasks } = await admin.from("tasks").select("id, title, video_name, client_id, status, updated_at")
        .is("deleted_at", null).not("client_id", "is", null).or("status.ilike.%revis%,status.eq.Finalizado");
      const pending = (tasks ?? []).filter((t) => byId.has(t.client_id));
      if (!pending.length) return [];
      const ids = pending.map((t) => t.id);
      const { data: hist } = await admin.from("task_stage_history").select("task_id, to_stage, created_at").in("task_id", ids).order("created_at", { ascending: false });
      const entered: Record<string, string> = {};
      pending.forEach((t) => { entered[t.id] = (hist ?? []).find((h) => h.task_id === t.id && h.to_stage === t.status)?.created_at ?? t.updated_at; });
      const { data: rev } = await admin.from("task_comments").select("task_id, created_at").eq("author", CLIENT_REVIEW_AUTHOR).in("task_id", ids);
      const answered = new Set((rev ?? []).filter((r) => r.created_at > entered[r.task_id]).map((r) => r.task_id));
      const { data: logs } = await admin.from("wa_automation_logs").select("client_id, ref, created_at, status")
        .eq("automation_id", a.id).eq("status", "enviado").gte("created_at", new Date(Date.now() - 60 * DAY).toISOString());
      const times = (taskId: string) => (logs ?? []).filter((l) => l.ref.split(",").includes(`task:${taskId}`)).length;
      const waiting = pending.filter((t) => !answered.has(t.id) && Date.now() - new Date(entered[t.id]).getTime() >= waitDays * DAY && times(t.id) < maxPerItem);
      const group = new Map<string, typeof waiting>();
      waiting.forEach((t) => group.set(t.client_id, [...(group.get(t.client_id) ?? []), t]));
      const jobs: Job[] = [];
      for (const [clientId, list] of group) {
        const recent = (logs ?? []).some((l) => l.client_id === clientId && Date.now() - new Date(l.created_at).getTime() < gapDays * DAY);
        if (recent) continue;
        const lines = list.slice(0, 3).map((t) => `• ${cleanTitle(t)}`).join("\n") + (list.length > 3 ? `\n• e mais ${list.length - 3}` : "");
        jobs.push(job(byId.get(clientId)!, {
          qtd: String(list.length),
          qtd_texto: list.length === 1 ? "Tem 1 conteúdo pronto" : `Tem ${list.length} conteúdos prontos`,
          lista_conteudos: lines,
        }, list.map((t) => `task:${t.id}`).join(",")));
      }
      return jobs;
    }

    case "monthly_report": {
      const prev = new Date(Date.UTC(spNow().getUTCFullYear(), spNow().getUTCMonth() - 1, 1));
      const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
      const { data: tasks } = await admin.from("tasks").select("client_id, status, post_date")
        .is("deleted_at", null).gte("post_date", `${key}-01`).lt("post_date", `${key}-32`);
      const count = new Map<string, number>();
      (tasks ?? []).filter((t) => /postado|publicado|conclu/i.test(t.status) && byId.has(t.client_id))
        .forEach((t) => count.set(t.client_id, (count.get(t.client_id) ?? 0) + 1));
      return [...count].map(([id, n]) => job(byId.get(id)!, {
        mes: MONTHS[prev.getUTCMonth()], qtd: String(n), link_relatorio: `${APP_URL}/relatorio/${id}?mes=${key}`,
      }, `report:${key}`));
    }

    case "invoice_due_soon":
    case "invoice_due_today":
    case "invoice_overdue": {
      const target = a.trigger === "invoice_due_soon" ? spDay(p.days_before ?? 3)
        : a.trigger === "invoice_due_today" ? spDay(0) : spDay(-(p.days_after ?? 3));
      const { data: inv } = await admin.from("invoices").select("id, client_name, description, amount, due_date, status")
        .eq("status", "pendente").eq("due_date", target);
      const byName = new Map(clients.map((c) => [String(c.company_name).trim().toLowerCase(), c]));
      return (inv ?? []).flatMap((i) => {
        const c = byName.get(String(i.client_name).trim().toLowerCase());
        return c ? [job(c, {
          descricao: i.description || "do mês", valor: brl(i.amount), vencimento: fmtDate(i.due_date), link_fatura: `${APP_URL}/fatura/${i.id}`,
        }, `invoice:${i.id}:${a.trigger}`)] : [];
      });
    }

    case "shooting_tomorrow": {
      // Gravações da agenda que acontecem daqui a N dias (0 = no próprio dia)
      const days = Math.max(0, p.days_before ?? 1);
      const { data: rows } = await admin.from("shooting_schedules").select("id, title, shooting_date, start_time, location, client_id, status").eq("shooting_date", spDay(days));
      const when = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
      return (rows ?? []).filter((s) => s.client_id && byId.has(s.client_id) && !/cancel/i.test(s.status ?? "")).map((s) => job(byId.get(s.client_id)!, {
        titulo: s.title, data: fmtDate(s.shooting_date), hora: s.start_time ? String(s.start_time).slice(0, 5) : "a combinar",
        local: s.location || "a combinar", quando: when,
      }, `shoot:${s.id}:${days}`));
    }

    case "post_today": {
      const { data: tasks } = await admin.from("tasks").select("id, title, video_name, client_id, status, post_time")
        .is("deleted_at", null).eq("post_date", spDay(0));
      const group = new Map<string, NonNullable<typeof tasks>>();
      (tasks ?? []).filter((t) => byId.has(t.client_id) && !/^ideia|backlog/i.test(t.status))
        .forEach((t) => group.set(t.client_id, [...(group.get(t.client_id) ?? []), t]));
      return [...group].map(([id, list]) => job(byId.get(id)!, {
        qtd: String(list.length),
        lista_conteudos: list.map((t) => `• ${cleanTitle(t)}${t.post_time ? ` às ${String(t.post_time).slice(0, 5)}` : ""}`).join("\n"),
      }, `post:${id}:${spDay(0)}`));
    }

    case "team_daily_summary": {
      const to = String(a.audience?.to ?? "").trim();
      const today = spDay(0);
      const { data: tasks } = await admin.from("tasks").select("id, status, post_date, caption, updated_at").is("deleted_at", null);
      const open = (tasks ?? []).filter((t) => !DONE.test(t.status));
      const { data: comments } = await admin.from("task_comments").select("task_id, content, author, created_at")
        .in("author", [CLIENT_REVIEW_AUTHOR, "Planner"]).order("created_at", { ascending: true }).limit(3000);
      const state: Record<string, string> = {};
      (comments ?? []).forEach((c) => { state[c.task_id] = c.content.startsWith("✅") ? "aprovado" : c.content.startsWith("📅") ? "agendado" : "ajuste"; });
      const vars = {
        aprovados: String(open.filter((t) => state[t.id] === "aprovado").length),
        atrasados: String(open.filter((t) => t.post_date && t.post_date < today && t.post_date >= spDay(-30)).length),
        sem_legenda: String(open.filter((t) => t.post_date && t.post_date >= today && t.post_date <= spDay(3) && !/[\p{L}\p{N}]{2,}/u.test(t.caption ?? "")).length),
        aguardando: String(open.filter((t) => /revis|finalizado/i.test(t.status) && !state[t.id] && Date.now() - new Date(t.updated_at).getTime() > 2 * DAY).length),
        link_meu_dia: `${APP_URL}/meu-dia`,
      };
      return [{ client: null, to: phoneOf(to) && !to.includes("@") ? phoneOf(to) : to || null, vars, ref: `summary:${today}` }];
    }

    case "manual":
      return clients.map((c) => job(c, {}, `manual:${a.id}`));

    // ── Cliente ──
    case "welcome_contract":
    case "sale_closed": {
      const { data: sigs } = await admin.from("contract_signatures").select("contract_id, signed_at").gte("signed_at", since);
      const ids = [...new Set((sigs ?? []).map((x) => x.contract_id))];
      if (!ids.length) return [];
      const { data: contracts } = await admin.from("contracts").select("id, client_id, client_name, client_company, monthly_value, total_value, plan_name").in("id", ids);
      if (a.trigger === "sale_closed") {
        return (contracts ?? []).map((ct) => teamJob({
          empresa: ct.client_company || ct.client_name || "Novo cliente", valor: brl(Number(ct.monthly_value || ct.total_value || 0)), plano: ct.plan_name || "",
        }, `sale:${ct.id}`));
      }
      return (contracts ?? []).filter((ct) => ct.client_id && byId.has(ct.client_id)).map((ct) => job(byId.get(ct.client_id)!, {}, `welcome:${ct.id}`));
    }

    case "onboarding_stalled": {
      const stalled = p.days_after ?? 3;
      const { data: rows } = await admin.from("client_onboardings").select("client_id, token, status, updated_at, steps").neq("status", "concluido");
      const { data: logs } = await admin.from("wa_automation_logs").select("client_id, created_at").eq("automation_id", a.id).eq("status", "enviado")
        .gte("created_at", new Date(Date.now() - (p.gap_days ?? 3) * DAY).toISOString());
      const recent = new Set((logs ?? []).map((l) => l.client_id));
      return (rows ?? []).filter((o) => byId.has(o.client_id) && !recent.has(o.client_id) && Date.now() - new Date(o.updated_at).getTime() >= stalled * DAY)
        .map((o) => job(byId.get(o.client_id)!, { link_onboarding: `${APP_URL}/bem-vindo/${o.token}` }, `onb:${o.client_id}:${spDay(0)}`));
    }

    case "change_received":
    case "approved_ack":
    case "change_request_team": {
      const approved = a.trigger === "approved_ack";
      const { data: comments } = await admin.from("task_comments").select("id, task_id, content, created_at")
        .eq("author", CLIENT_REVIEW_AUTHOR).gte("created_at", since);
      const list = (comments ?? []).filter((c) => c.content.startsWith(approved ? "✅" : "✏️"));
      if (!list.length) return [];
      const { data: tasks } = await admin.from("tasks").select(`id, title, video_name, client_id, post_date, post_time, ${ROLE_FIELDS.join(", ")}`).in("id", list.map((c) => c.task_id));
      const byTask = new Map((tasks ?? []).map((t) => [t.id, t]));
      return list.flatMap((c) => {
        const t = byTask.get(c.task_id);
        if (!t) return [];
        const pedido = c.content.replace(/^[^\n]*\n?/, "").trim();
        if (a.trigger === "change_request_team") {
          return personJobs(ROLE_FIELDS.map((f) => t[f]), () => ({
            cliente: clientName(t.client_id), titulo: taskTitle(t), pedido, link_tarefa: `${APP_URL}/tarefas?taskId=${t.id}`,
          }), `chgteam:${c.id}`);
        }
        if (!t.client_id || !byId.has(t.client_id)) return [];
        return [job(byId.get(t.client_id)!, {
          titulo: taskTitle(t), pedido,
          data_post: t.post_date ? `${fmtDate(t.post_date)}${t.post_time ? ` às ${String(t.post_time).slice(0, 5)}` : ""}` : "em breve",
        }, `${approved ? "apr" : "chg"}:${c.id}`)];
      });
    }

    case "partnership_anniversary": {
      const today = spDay(0);
      const { data: rows } = await admin.from("clients").select("id, contract_start_date").not("contract_start_date", "is", null);
      return (rows ?? []).filter((r) => byId.has(r.id) && String(r.contract_start_date).slice(8, 10) === today.slice(8, 10)).flatMap((r) => {
        const m = monthsBetween(String(r.contract_start_date), today);
        if (m !== 6 && !(m > 0 && m % 12 === 0)) return [];
        return [job(byId.get(r.id)!, { tempo: m === 6 ? "6 meses" : m === 12 ? "1 ano" : `${m / 12} anos` }, `anniv:${r.id}:${today}`)];
      });
    }

    case "satisfaction_survey": {
      const month = spDay(0).slice(0, 7);
      return clients.map((c) => job(c, { mes: MONTHS[Number(month.slice(5)) - 1] }, `nps:${month}`));
    }

    // ── Financeiro ──
    case "payment_confirmed":
    case "invoice_created": {
      const paid = a.trigger === "payment_confirmed";
      const q = admin.from("invoices").select("id, client_name, description, amount, due_date, status, paid_at, created_at");
      const { data: inv } = paid ? await q.eq("status", "pago").gte("paid_at", since) : await q.eq("status", "pendente").gte("created_at", since);
      const byName = new Map(clients.map((c) => [String(c.company_name).trim().toLowerCase(), c]));
      return (inv ?? []).flatMap((i) => {
        const c = byName.get(String(i.client_name).trim().toLowerCase());
        return c ? [job(c, {
          descricao: i.description || "do mês", valor: brl(i.amount), vencimento: i.due_date ? fmtDate(i.due_date) : "", link_fatura: `${APP_URL}/fatura/${i.id}`,
        }, `${paid ? "paid" : "newinv"}:${i.id}`)] : [];
      });
    }

    case "contract_ending": {
      const target = spDay(p.days_before ?? 30);
      const { data: rows } = await admin.from("contracts").select("id, client_id, duration_months, sent_at, created_at, status").eq("status", "assinado");
      return (rows ?? []).filter((ct) => ct.client_id && byId.has(ct.client_id) && ct.duration_months).flatMap((ct) => {
        const start = new Date((ct.sent_at ?? ct.created_at).slice(0, 10) + "T12:00:00Z");
        start.setUTCMonth(start.getUTCMonth() + Number(ct.duration_months));
        const end = start.toISOString().slice(0, 10);
        return end === target ? [job(byId.get(ct.client_id)!, { fim_contrato: fmtDate(end) }, `end:${ct.id}`)] : [];
      });
    }

    // ── Produção ──
    case "post_published": {
      const { data: targets } = await admin.from("publish_targets").select("id, job_id, permalink, published_at, status")
        .eq("status", "published").gte("published_at", since);
      if (!targets?.length) return [];
      const { data: jobsRows } = await admin.from("publish_jobs").select("id, client_id").in("id", targets.map((t) => t.job_id));
      const clientOf = new Map((jobsRows ?? []).map((j) => [j.id, j.client_id]));
      return targets.flatMap((t) => {
        const cid = clientOf.get(t.job_id);
        return cid && byId.has(cid) ? [job(byId.get(cid)!, { link_post: t.permalink || "" }, `pub:${t.id}`)] : [];
      });
    }

    case "next_week": {
      // Próxima segunda a domingo
      const dow = spNow().getUTCDay();
      const startOff = ((8 - dow) % 7) || 7;
      const from = spDay(startOff), to = spDay(startOff + 6);
      const { data: tasks } = await admin.from("tasks").select("id, title, video_name, client_id, status, post_date, post_time")
        .is("deleted_at", null).gte("post_date", from).lte("post_date", to);
      const group = new Map<string, NonNullable<typeof tasks>>();
      (tasks ?? []).filter((t) => byId.has(t.client_id) && !/^ideia|backlog/i.test(t.status))
        .forEach((t) => group.set(t.client_id, [...(group.get(t.client_id) ?? []), t]));
      return [...group].map(([id, list]) => job(byId.get(id)!, {
        qtd: String(list.length),
        lista_conteudos: list.sort((x, y) => String(x.post_date).localeCompare(String(y.post_date)))
          .map((t) => `• ${fmtDate(t.post_date!).slice(0, 5)} — ${cleanTitle(t)}`).join("\n"),
      }, `week:${id}:${from}`));
    }

    // ── Equipe ──
    case "task_assigned": {
      const { data: tasks } = await admin.from("tasks").select(`id, title, video_name, client_id, due_date, post_date, ${ROLE_FIELDS.join(", ")}`)
        .is("deleted_at", null).gte("created_at", since);
      return (tasks ?? []).flatMap((t) => personJobs(ROLE_FIELDS.map((f) => t[f]), () => ({
        titulo: taskTitle(t), cliente: clientName(t.client_id),
        prazo: t.due_date ? fmtDate(t.due_date) : t.post_date ? fmtDate(t.post_date) : "sem prazo", link_tarefa: `${APP_URL}/tarefas?taskId=${t.id}`,
      }), `newtask:${t.id}`));
    }

    case "deadline_tomorrow": {
      const day = spDay(p.days_before ?? 1);
      const { data: tasks } = await admin.from("tasks").select(`id, title, video_name, client_id, status, due_date, ${ROLE_FIELDS.join(", ")}`)
        .is("deleted_at", null).eq("due_date", day);
      const open = (tasks ?? []).filter((t) => !DONE.test(t.status) && !/finalizado|revis/i.test(t.status));
      const perPerson = new Map<string, typeof open>();
      open.forEach((t) => [...new Set(ROLE_FIELDS.map((f) => String(t[f] ?? "").trim().toLowerCase()).filter(Boolean))]
        .forEach((n) => perPerson.set(n, [...(perPerson.get(n) ?? []), t])));
      return [...perPerson].flatMap(([n, list]) => personJobs([n], () => ({
        qtd: String(list.length), data: fmtDate(day),
        lista_tarefas: list.map((t) => `• ${taskTitle(t)} (${clientName(t.client_id)}) — ${t.status}`).join("\n"),
      }), `due:${day}`));
    }

    case "lead_stalled": {
      const days = p.days_after ?? 3;
      const { data: leads } = await admin.from("leads").select("id, name, company, stage, closer, assignee, updated_at, contacted_at");
      const stale = (leads ?? []).filter((l) => !/fechado|perdido/i.test(l.stage ?? "")
        && Date.now() - new Date(l.contacted_at ?? l.updated_at).getTime() >= days * DAY);
      const perPerson = new Map<string, typeof stale>();
      stale.forEach((l) => { const n = String(l.closer || l.assignee || "").trim().toLowerCase(); if (n) perPerson.set(n, [...(perPerson.get(n) ?? []), l]); });
      return [...perPerson].flatMap(([n, list]) => personJobs([n], () => ({
        qtd: String(list.length),
        lista_leads: list.slice(0, 10).map((l) => `• ${l.company || l.name} — ${l.stage}`).join("\n") + (list.length > 10 ? `\n• e mais ${list.length - 10}` : ""),
        link_crm: `${APP_URL}/crm`,
      }), `lead:${spDay(0)}`));
    }

    case "script_missing": {
      const days = p.days_before ?? 3;
      const { data: shoots } = await admin.from("shooting_schedules").select("client_id, shooting_date").gte("shooting_date", spDay(0)).lte("shooting_date", spDay(days));
      const soon = new Set((shoots ?? []).map((x) => x.client_id).filter(Boolean));
      const { data: tasks } = await admin.from("tasks").select(`id, title, video_name, client_id, status, full_script, ${ROLE_FIELDS.join(", ")}`)
        .is("deleted_at", null).or("status.ilike.%capta%,status.ilike.%grava%");
      const missing = (tasks ?? []).filter((t) => (soon.has(t.client_id) || /proxima|próxima/i.test(t.status)) && !String(t.full_script ?? "").trim());
      const perPerson = new Map<string, typeof missing>();
      missing.forEach((t) => { const n = String(t.copywriter || t.script_writer || t.assignee || "").trim().toLowerCase(); if (n) perPerson.set(n, [...(perPerson.get(n) ?? []), t]); });
      return [...perPerson].flatMap(([n, list]) => personJobs([n], () => ({
        qtd: String(list.length), lista_tarefas: list.map((t) => `• ${taskTitle(t)} (${clientName(t.client_id)})`).join("\n"),
      }), `script:${spDay(0)}`));
    }

    case "client_at_risk": {
      const today = spDay(0);
      const { data: tasks } = await admin.from("tasks").select("client_id, status, post_date").is("deleted_at", null)
        .lt("post_date", today).gte("post_date", spDay(-30));
      const late = new Map<string, number>();
      (tasks ?? []).filter((t) => byId.has(t.client_id) && !DONE.test(t.status)).forEach((t) => late.set(t.client_id, (late.get(t.client_id) ?? 0) + 1));
      const { data: inv } = await admin.from("invoices").select("client_name, due_date").eq("status", "pendente").lt("due_date", spDay(-10));
      const overdue = new Set((inv ?? []).map((i) => String(i.client_name).trim().toLowerCase()));
      const risky = clients.filter((c) => (late.get(c.id) ?? 0) >= 3 || overdue.has(String(c.company_name).trim().toLowerCase()));
      if (!risky.length) return [];
      return [teamJob({
        qtd: String(risky.length),
        lista_clientes: risky.slice(0, 15).map((c) => `• ${c.company_name}${(late.get(c.id) ?? 0) >= 3 ? ` — ${late.get(c.id)} posts atrasados` : ""}${overdue.has(String(c.company_name).trim().toLowerCase()) ? " — fatura vencida há 10+ dias" : ""}`).join("\n"),
        link_clientes: `${APP_URL}/clientes`,
      }, `risk:${today}`)];
    }

    case "instagram_disconnected": {
      const { data: accs } = await admin.from("social_accounts").select("username, token_status").eq("platform", "instagram");
      const broken = (accs ?? []).filter((x) => x.token_status && x.token_status !== "ok");
      if (!broken.length) return [];
      return [teamJob({ qtd: String(broken.length), lista_contas: broken.map((x) => `• @${x.username}`).join("\n"), link_redes: `${APP_URL}/redes-sociais` },
        `ig:${broken.map((x) => x.username).sort().join(",")}:${spDay(0)}`)];
    }

    case "shooting_team": {
      const day = spDay(p.days_before ?? 1);
      const { data: rows } = await admin.from("shooting_schedules").select("title, start_time, location, client_id, status").eq("shooting_date", day);
      const list = (rows ?? []).filter((x) => !/cancel/i.test(x.status ?? ""));
      if (!list.length) return [];
      return [teamJob({
        data: fmtDate(day), qtd: String(list.length),
        lista_gravacoes: list.sort((x, y) => String(x.start_time).localeCompare(String(y.start_time)))
          .map((x) => `• ${x.start_time ? String(x.start_time).slice(0, 5) : "--:--"} — ${x.title}${x.location ? ` (${x.location})` : ""}`).join("\n"),
      }, `shootteam:${day}`)];
    }

    default:
      return [];
  }
}

// ─── Envio ───────────────────────────────────────────────────────────────────
async function sendWhatsApp(to: string, message: string) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) throw new Error("WA_SERVER_URL não configurado");
  const res = await fetch(`${url}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300));
}

async function runAutomation(admin: SupabaseClient, a: Automation) {
  const jobs = await buildJobs(admin, a);
  // Não repete o que já foi enviado com sucesso (mesma chave)
  const refs = jobs.map((j) => j.ref);
  const { data: done } = refs.length
    ? await admin.from("wa_automation_logs").select("ref, client_id").eq("automation_id", a.id).eq("status", "enviado").in("ref", refs)
    : { data: [] };
  const sent = new Set((done ?? []).map((d) => `${d.ref}|${d.client_id ?? ""}`));
  let ok = 0;
  for (const j of jobs) {
    if (sent.has(`${j.ref}|${j.client?.id ?? ""}`)) continue;
    const message = render(a.template, j.vars);
    const row = { automation_id: a.id, client_id: j.client?.id ?? null, ref: j.ref, recipient: j.to ?? "", message, status: "enviado", error: "" };
    if (!j.to) row.status = "sem_contato";
    else {
      try { await sendWhatsApp(j.to, message); ok++; }
      catch (e) { row.status = "erro"; row.error = String((e as Error).message).slice(0, 300); }
      // Pausa curta entre mensagens: envio em rajada aumenta o risco de bloqueio
      await new Promise((r) => setTimeout(r, 1500));
    }
    await admin.from("wa_automation_logs").insert(row);
  }
  return { total: jobs.length, sent: ok };
}

/** A automação está no horário agora? (roda uma vez por dia, no dia da semana e a partir do horário marcado) */
function isDue(a: Automation) {
  const now = spNow();
  // Eventos: toda rodada, dentro da janela de horário e nos dias marcados
  if (EVENT_TRIGGERS.has(a.trigger)) {
    const h = now.getUTCHours();
    return a.days_of_week.includes(now.getUTCDay()) && h >= (a.params?.start_hour ?? 8) && h < (a.params?.end_hour ?? 20);
  }
  const today = now.toISOString().slice(0, 10);
  if (a.last_run_at && new Date(new Date(a.last_run_at).getTime() - 3 * 3_600_000).toISOString().slice(0, 10) === today) return false;
  if (a.trigger === "monthly_report") { if (now.getUTCDate() !== (a.params?.day_of_month ?? 1)) return false; }
  else if (!a.days_of_week.includes(now.getUTCDay())) return false;
  const [h, m] = a.send_time.split(":").map(Number);
  return now.getUTCHours() * 60 + now.getUTCMinutes() >= h * 60 + m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "run");

    if (action === "run") {
      const { data } = await admin.from("wa_automations").select("*").eq("enabled", true);
      const results: Record<string, unknown>[] = [];
      for (const a of (data ?? []) as Automation[]) {
        if (a.trigger === "manual") {
          if (a.sent_at || !a.scheduled_at || new Date(a.scheduled_at).getTime() > Date.now()) continue;
          const r = await runAutomation(admin, a);
          await admin.from("wa_automations").update({ sent_at: new Date().toISOString(), last_run_at: new Date().toISOString() }).eq("id", a.id);
          results.push({ name: a.name, ...r });
        } else if (isDue(a)) {
          // Marca antes de enviar: se a próxima rodada do cron chegar no meio, não duplica
          // (sem mexer em updated_at, que é a referência de "desde quando" dos eventos)
          await admin.from("wa_automations").update({ last_run_at: new Date().toISOString() }).eq("id", a.id);
          results.push({ name: a.name, ...(await runAutomation(admin, a)) });
        }
      }
      return json({ ran: results });
    }

    // Prévia e teste: só para quem está logado na plataforma
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(token);
    if (!user?.user) return json({ error: "Faça login na plataforma" }, 401);

    const { data: a } = await admin.from("wa_automations").select("*").eq("id", body.automation_id).maybeSingle();
    // Permite prévia de uma automação ainda não salva (rascunho vindo do editor)
    const automation = { ...(a ?? {}), ...(body.draft ?? {}) } as Automation;
    if (!automation.trigger) return json({ error: "Automação não encontrada" }, 404);

    const jobs = await buildJobs(admin, automation);
    const items = jobs.slice(0, 50).map((j) => ({
      client: j.client?.company_name ?? "Equipe",
      destination: !j.to ? "sem contato" : j.to.includes("@g.us") ? "grupo" : "telefone",
      message: render(automation.template, j.vars),
    }));

    if (action === "preview") return json({ total: jobs.length, items });

    if (action === "test") {
      const to = phoneOf(body.to);
      if (!to) return json({ error: "Informe um telefone válido para o teste" }, 400);
      const message = items[0]?.message ?? render(automation.template, {});
      await sendWhatsApp(to, `🧪 *Teste: ${automation.name}*\n\n${message}`);
      await admin.from("wa_automation_logs").insert({ automation_id: a?.id ?? null, ref: "teste", recipient: to, message, status: "teste" });
      return json({ ok: true, sample_from: items[0]?.client ?? null });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("wa-automations error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
