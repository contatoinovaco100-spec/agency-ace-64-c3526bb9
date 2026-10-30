// Relatório mensal pelo WhatsApp (cron: dia 1 de cada mês, 10h de Brasília).
// Para cada cliente ativo que teve conteúdo publicado no mês anterior, manda o link /relatorio no grupo
// do cliente (ou no telefone). Fica registrado em `approval_reminders` com kind = 'relatorio'.
// Chamada com {"dry_run": true} só monta as mensagens, sem enviar nem registrar.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_URL = Deno.env.get("APP_URL") || "https://inovamarketing.online";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DONE = /postado|publicado|conclu/i;

function phoneOf(raw: string | null) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dry_run;

    // Mês anterior no horário de Brasília
    const sp = new Date(Date.now() - 3 * 3_600_000);
    const prev = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth() - 1, 1));
    const monthKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthName = MONTHS[prev.getUTCMonth()];

    // Não manda duas vezes o mesmo mês
    const { data: already } = await admin.from("approval_reminders").select("client_id")
      .eq("kind", "relatorio").gte("created_at", `${sp.toISOString().slice(0, 7)}-01`);
    const sentClients = new Set((already ?? []).map((r) => r.client_id));

    const { data: tasks } = await admin.from("tasks").select("client_id, status, post_date")
      .is("deleted_at", null).not("client_id", "is", null)
      .gte("post_date", `${monthKey}-01`).lt("post_date", `${monthKey}-32`);
    const delivered = new Map<string, number>();
    (tasks ?? []).filter((t) => DONE.test(t.status)).forEach((t) => delivered.set(t.client_id, (delivered.get(t.client_id) ?? 0) + 1));
    if (!delivered.size) return json({ sent: 0, reason: `Nada publicado em ${monthName}` });

    const { data: clients } = await admin.from("clients").select("*").in("id", [...delivered.keys()]);
    const WA_URL = Deno.env.get("WA_SERVER_URL");
    const WA_KEY = Deno.env.get("WA_API_KEY") ?? "";
    if (!WA_URL && !dryRun) return json({ error: "WA_SERVER_URL não configurado" }, 500);

    const results: Record<string, unknown>[] = [];
    for (const c of clients ?? []) {
      if ((c.status && c.status !== "Ativo") || sentClients.has(c.id)) continue;
      const n = delivered.get(c.id)!;
      const to = String(c.whatsapp_group_id ?? "").trim() || phoneOf(c.phone);
      const name = String(c.contact_name || c.company_name || "").trim().split(/\s+/)[0];
      const message = `Oi, ${name}! 📊 Aqui é da INOVA.\n\nSeu relatório de *${monthName}* está pronto: foram *${n} ${n === 1 ? "conteúdo" : "conteúdos"}* no ar.\n\n` +
        `Veja o que foi publicado e o que vem por aí:\n👉 ${APP_URL}/relatorio/${c.id}?mes=${monthKey}`;
      const row: Record<string, unknown> = { client_id: c.id, kind: "relatorio", task_ids: [], phone: to ?? "", message, status: "enviado", error: "" };

      if (!to) row.status = "sem_telefone";
      else if (!dryRun) {
        try {
          const res = await fetch(`${WA_URL}/send`, {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": WA_KEY },
            body: JSON.stringify({ to, message }),
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
      month: monthKey, dry_run: dryRun,
      sent: results.filter((r) => r.status === "enviado").length,
      without_contact: results.filter((r) => r.status === "sem_telefone").map((r) => r.company),
      errors: results.filter((r) => r.status === "erro").length,
      results: dryRun ? results.map(({ phone: _p, ...r }) => r) : undefined,
    });
  } catch (e) {
    console.error("monthly-reports error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
