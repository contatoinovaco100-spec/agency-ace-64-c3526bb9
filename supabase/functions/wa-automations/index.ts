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
  scheduled_at: string | null; sent_at: string | null; last_run_at: string | null;
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

// ─── Gatilhos: cada um devolve a lista de envios ─────────────────────────────
async function buildJobs(admin: SupabaseClient, a: Automation): Promise<Job[]> {
  const p = a.params ?? {};
  const { data: clientRows } = await admin.from("clients").select("*").is("deleted_at", null);
  let clients = ((clientRows ?? []) as Client[]).filter((c) => !c.status || c.status === "Ativo");
  if (a.audience?.type === "clients") clients = clients.filter((c) => a.audience.client_ids?.includes(c.id));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const job = (c: Client, extra: Record<string, string>, ref: string): Job =>
    ({ client: c, to: recipientFor(c, a.destination), vars: { ...clientVars(c), ...extra }, ref });

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
