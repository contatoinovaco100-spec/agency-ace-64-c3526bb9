// Lembrete de aprovação pelo WhatsApp (cron: seg a sex, 10h de Brasília).
// Para cada cliente com conteúdo esperando aprovação há 2 dias ou mais, manda uma mensagem com o link /conteudo.
// Regras: no máximo 1 lembrete por cliente a cada 3 dias e 3 lembretes por conteúdo; cliente sem telefone
// fica registrado para a equipe completar o cadastro. Cada envio fica em `approval_reminders`.
// Chamada com {"dry_run": true} só monta as mensagens, sem enviar nem registrar.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAY = 86_400_000;
const MIN_WAIT_DAYS = 2;
const CLIENT_GAP_DAYS = 3;
const MAX_PER_TASK = 3;
const CLIENT_REVIEW_AUTHOR = "Cliente (link de aprovação)";
const APP_URL = Deno.env.get("APP_URL") || "https://inovamarketing.online";

type Task = { id: string; title: string | null; video_name: string | null; client_id: string | null; status: string; updated_at: string };
type Reminder = { client_id: string; task_ids: string[]; status: string; created_at: string };

const cleanTitle = (t: Task) => (t.video_name || t.title || "Conteúdo").replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, "");

function phoneOf(raw: string | null) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

function messageFor(contact: string, company: string, tasks: Task[], link: string) {
  const name = (contact || company).trim().split(/\s+/)[0];
  const list = tasks.slice(0, 3).map((t) => `• ${cleanTitle(t)}`).join("\n");
  const more = tasks.length > 3 ? `\n• e mais ${tasks.length - 3}` : "";
  const head = tasks.length === 1
    ? "Tem 1 conteúdo pronto esperando a sua aprovação:"
    : `Tem ${tasks.length} conteúdos prontos esperando a sua aprovação:`;
  return `Oi, ${name}! 👋 Aqui é da INOVA.\n\n${head}\n${list}${more}\n\n👉 ${link}\n\n` +
    `É só abrir, assistir e tocar em *Aprovar* ou *Pedir ajuste*. Assim a gente já agenda a publicação. 😉`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dry_run;

    // Só em dia útil no horário de Brasília (o cron já roda seg a sex; isto protege chamadas manuais)
    const spDay = new Date(Date.now() - 3 * 3_600_000).getUTCDay();
    if (!dryRun && (spDay === 0 || spDay === 6)) return json({ skipped: true, reason: "Fim de semana" });

    // Conteúdos com o cliente para aprovação
    const { data: tasks } = await admin.from("tasks")
      .select("id, title, video_name, client_id, status, updated_at")
      .is("deleted_at", null).not("client_id", "is", null)
      .or("status.ilike.%revis%,status.eq.Finalizado");
    const pending = (tasks ?? []) as Task[];
    if (!pending.length) return json({ sent: 0, reason: "Nada esperando aprovação" });
    const ids = pending.map((t) => t.id);

    // Quando cada um entrou na etapa atual (histórico do kanban; sem histórico, a última alteração)
    const { data: history } = await admin.from("task_stage_history")
      .select("task_id, to_stage, created_at").in("task_id", ids).order("created_at", { ascending: false });
    const enteredAt: Record<string, string> = {};
    for (const t of pending) {
      const h = (history ?? []).find((r) => r.task_id === t.id && r.to_stage === t.status);
      enteredAt[t.id] = h?.created_at ?? t.updated_at;
    }

    // Já respondido pelo cliente depois de entrar na etapa: não lembra
    const { data: reviews } = await admin.from("task_comments")
      .select("task_id, created_at").eq("author", CLIENT_REVIEW_AUTHOR).in("task_id", ids);
    const answered = new Set((reviews ?? []).filter((r) => r.created_at > enteredAt[r.task_id]).map((r) => r.task_id));

    const { data: pastRows } = await admin.from("approval_reminders")
      .select("client_id, task_ids, status, created_at").gte("created_at", new Date(Date.now() - 60 * DAY).toISOString());
    const past = (pastRows ?? []) as Reminder[];
    const timesReminded = (taskId: string) => past.filter((r) => r.status === "enviado" && r.task_ids.includes(taskId)).length;

    const now = Date.now();
    const waiting = pending.filter((t) =>
      !answered.has(t.id) && now - new Date(enteredAt[t.id]).getTime() >= MIN_WAIT_DAYS * DAY && timesReminded(t.id) < MAX_PER_TASK);

    const byClient = new Map<string, Task[]>();
    waiting.forEach((t) => byClient.set(t.client_id!, [...(byClient.get(t.client_id!) ?? []), t]));
    if (!byClient.size) return json({ sent: 0, reason: "Nenhum conteúdo esperando há 2 dias ou mais" });

    const { data: clients } = await admin.from("clients")
      .select("id, company_name, contact_name, phone, status").in("id", [...byClient.keys()]);

    const ZAPI_BASE = `https://api.z-api.io/instances/${Deno.env.get("ZAPI_INSTANCE_ID")}/token/${Deno.env.get("ZAPI_TOKEN")}`;
    const CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const results: Record<string, unknown>[] = [];

    for (const c of clients ?? []) {
      if (c.status && c.status !== "Ativo") continue;
      const list = byClient.get(c.id)!;
      const recent = past.find((r) => r.client_id === c.id && now - new Date(r.created_at).getTime() < CLIENT_GAP_DAYS * DAY
        && (r.status === "enviado" || r.status === "sem_telefone"));
      if (recent) continue;

      const phone = phoneOf(c.phone);
      const link = `${APP_URL}/conteudo/${c.id}`;
      const message = messageFor(c.contact_name ?? "", c.company_name ?? "", list, link);
      const row: Record<string, unknown> = {
        client_id: c.id, task_ids: list.map((t) => t.id), phone: phone ?? "", message, status: "enviado", error: "",
      };

      if (!phone) {
        row.status = "sem_telefone";
      } else if (!dryRun) {
        try {
          const res = await fetch(`${ZAPI_BASE}/send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(CLIENT_TOKEN ? { "Client-Token": CLIENT_TOKEN } : {}) },
            body: JSON.stringify({ phone, message }),
          });
          if (!res.ok) { row.status = "erro"; row.error = (await res.text()).slice(0, 300); }
        } catch (e) {
          row.status = "erro"; row.error = String((e as Error).message).slice(0, 300);
        }
      }
      results.push({ ...row, company: c.company_name });
      if (!dryRun) await admin.from("approval_reminders").insert(row);
    }

    return json({
      dry_run: dryRun,
      sent: results.filter((r) => r.status === "enviado").length,
      without_phone: results.filter((r) => r.status === "sem_telefone").map((r) => r.company),
      errors: results.filter((r) => r.status === "erro").length,
      // Sem telefone na resposta: a função é pública para o cron conseguir chamar
      results: dryRun ? results.map(({ phone: _phone, ...r }) => r) : undefined,
    });
  } catch (e) {
    console.error("approval-reminders error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
