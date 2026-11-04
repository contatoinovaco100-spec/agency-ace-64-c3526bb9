// Assistente da plataforma no WhatsApp: o admin manda uma pergunta para o número da INOVA e recebe a resposta
// com os dados da plataforma (tarefas, clientes, CRM, financeiro, gravações, equipe). Só leitura: não altera nada.
// Chamado pelo wa-inbound quando a mensagem vem do WhatsApp de um admin (Funcionários → WhatsApp).
// deno-lint-ignore-file no-explicit-any
import { phoneKey } from "./crm.ts";

const DONE = /postado|publicado|conclu|programado|finalizado|arquivad/i;
const spNow = () => new Date(Date.now() - 3 * 3_600_000);
const spDay = (offset = 0) => new Date(spNow().getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const like = (s: string) => `%${s.trim().replace(/[%_,()]/g, " ")}%`;
const dateOf = (t: any) => String(t.post_date || t.due_date || "");
const people = (t: any) => [t.assignee, t.copywriter, t.script_writer, t.editor, t.videomaker, t.director].filter(Boolean).join(", ");

/** É o WhatsApp de um admin? Compara DDD + 8 últimos dígitos com o WhatsApp do cadastro. */
export async function adminByPhone(admin: any, phone: string): Promise<{ id: string; name: string } | null> {
  const key = phoneKey(phone);
  if (!key) return null;
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: any) => r.user_id);
  if (!ids.length) return null;
  const { data: profs } = await admin.from("profiles").select("id, full_name, whatsapp").in("id", ids);
  const p = (profs ?? []).find((x: any) => phoneKey(x.whatsapp) === key);
  return p ? { id: p.id, name: String(p.full_name || "") } : null;
}

async function clientIds(admin: any, name?: string) {
  if (!name?.trim()) return null;
  const { data } = await admin.from("clients").select("id, company_name").ilike("company_name", like(name)).is("deleted_at", null);
  return (data ?? []) as { id: string; company_name: string }[];
}

async function clientNames(admin: any, ids: string[]) {
  if (!ids.length) return {} as Record<string, string>;
  const { data } = await admin.from("clients").select("id, company_name").in("id", [...new Set(ids)]);
  return Object.fromEntries((data ?? []).map((c: any) => [c.id, c.company_name])) as Record<string, string>;
}

// ─── Ferramentas (consultas) ──────────────────────────────────────────────────
const TOOLS: Record<string, { description: string; parameters: Record<string, unknown>; run: (admin: any, a: any) => Promise<unknown> }> = {
  resumo_do_dia: {
    description: "Panorama de hoje: posts e entregas de hoje, atrasadas, gravações, leads novos, faturas vencendo e atrasadas.",
    parameters: { type: "object", properties: {} },
    run: async (admin) => {
      const today = spDay();
      const { data: tasks } = await admin.from("tasks").select("title, video_name, status, post_date, due_date, assignee, client_id")
        .is("deleted_at", null).gte("post_date", spDay(-30)).lte("post_date", today);
      const open = (tasks ?? []).filter((t: any) => !DONE.test(String(t.status)));
      const [{ data: shoots }, { count: leadsToday }, { data: inv }] = await Promise.all([
        admin.from("shooting_schedules").select("title, start_time, location, client_id").eq("shooting_date", today),
        admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", `${today}T03:00:00Z`),
        admin.from("invoices").select("client_name, amount, due_date").eq("status", "pendente").lte("due_date", spDay(3)),
      ]);
      return {
        hoje: today,
        posts_hoje_pendentes: open.filter((t: any) => dateOf(t) === today).length,
        atrasadas: open.filter((t: any) => dateOf(t) < today).length,
        gravacoes_hoje: (shoots ?? []).map((s: any) => `${s.start_time?.slice(0, 5) ?? ""} ${s.title}`.trim()),
        leads_novos_hoje: leadsToday ?? 0,
        faturas_atrasadas: (inv ?? []).filter((i: any) => i.due_date < today).map((i: any) => `${i.client_name} ${brl(Number(i.amount))} (venceu ${i.due_date})`),
        faturas_vencendo_3_dias: (inv ?? []).filter((i: any) => i.due_date >= today).map((i: any) => `${i.client_name} ${brl(Number(i.amount))} (${i.due_date})`),
      };
    },
  },

  buscar_tarefas: {
    description: "Tarefas/posts do kanban. Filtra por cliente, pessoa (responsável, roteirista, editor...), período e status.",
    parameters: {
      type: "object",
      properties: {
        cliente: { type: "string", description: "Nome (ou parte) do cliente" },
        pessoa: { type: "string", description: "Nome de quem está na tarefa" },
        periodo: { type: "string", enum: ["atrasadas", "hoje", "amanha", "semana", "proximas", "todas_abertas"] },
        status: { type: "string", description: "Etapa do kanban, ex.: Revisão, Aprovação, Edição" },
      },
    },
    run: async (admin, a) => {
      let q = admin.from("tasks").select("title, video_name, status, post_date, post_time, due_date, assignee, copywriter, script_writer, editor, videomaker, director, client_id")
        .is("deleted_at", null).or(`post_date.gte.${spDay(-60)},post_date.is.null`).order("post_date", { ascending: true }).limit(1000);
      const cs = await clientIds(admin, a.cliente);
      if (cs) { if (!cs.length) return { erro: `Nenhum cliente com "${a.cliente}"` }; q = q.in("client_id", cs.map((c) => c.id)); }
      if (a.status) q = q.ilike("status", like(a.status));
      const { data } = await q;
      const today = spDay();
      let list = (data ?? []).filter((t: any) => a.status || !DONE.test(String(t.status)));
      if (a.pessoa) { const p = a.pessoa.toLowerCase(); list = list.filter((t: any) => people(t).toLowerCase().includes(p)); }
      const d = (t: any) => dateOf(t);
      if (a.periodo === "atrasadas") list = list.filter((t: any) => d(t) && d(t) < today);
      if (a.periodo === "hoje") list = list.filter((t: any) => d(t) === today);
      if (a.periodo === "amanha") list = list.filter((t: any) => d(t) === spDay(1));
      if (a.periodo === "semana") list = list.filter((t: any) => d(t) >= today && d(t) <= spDay(7));
      if (a.periodo === "proximas") list = list.filter((t: any) => d(t) >= today);
      const names = await clientNames(admin, list.map((t: any) => t.client_id).filter(Boolean));
      return {
        total: list.length,
        tarefas: list.slice(0, 40).map((t: any) => ({
          titulo: t.video_name || t.title, cliente: names[t.client_id] ?? "", etapa: t.status,
          postar: [t.post_date, t.post_time?.slice(0, 5)].filter(Boolean).join(" "), entrega: t.due_date, pessoas: people(t),
        })),
      };
    },
  },

  buscar_clientes: {
    description: "Clientes: status, valor mensal, curva ABC, contato, gestor, início do contrato. Sem nome lista todos os ativos.",
    parameters: { type: "object", properties: { nome: { type: "string" }, status: { type: "string", description: "Ativo, Pausado ou Cancelado" } } },
    run: async (admin, a) => {
      let q = admin.from("clients").select("company_name, status, monthly_value, billing_type, abc_class, contact_name, phone, account_manager, contract_start_date, service_type")
        .is("deleted_at", null).order("monthly_value", { ascending: false }).limit(100);
      if (a.nome) q = q.ilike("company_name", like(a.nome));
      else q = q.eq("status", a.status || "Ativo");
      if (a.nome && a.status) q = q.eq("status", a.status);
      const { data } = await q;
      return { total: data?.length ?? 0, clientes: (data ?? []).map((c: any) => ({ ...c, monthly_value: brl(Number(c.monthly_value) || 0) })) };
    },
  },

  financeiro: {
    description: "MRR (clientes ativos, sem serviço pontual), faturas pendentes e atrasadas, recebido e gastos de um mês.",
    parameters: { type: "object", properties: { mes: { type: "string", description: "AAAA-MM; padrão o mês atual" } } },
    run: async (admin, a) => {
      const mes = /^\d{4}-\d{2}$/.test(a.mes ?? "") ? a.mes : spDay().slice(0, 7);
      const today = spDay();
      const [{ data: cl }, { data: inv }, { data: exp }] = await Promise.all([
        admin.from("clients").select("monthly_value, billing_type, status").is("deleted_at", null).eq("status", "Ativo"),
        admin.from("invoices").select("client_name, amount, due_date, status, paid_at").gte("due_date", `${mes}-01`).lte("due_date", `${mes}-31`),
        admin.from("expenses").select("amount, category, spent_on").gte("spent_on", `${mes}-01`).lte("spent_on", `${mes}-31`),
      ]);
      const mrr = (cl ?? []).reduce((s: number, c: any) => s + (c.billing_type === "pontual" ? 0 : Number(c.monthly_value) || 0), 0);
      const pend = (inv ?? []).filter((i: any) => i.status === "pendente");
      const sum = (l: any[]) => l.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const byCat: Record<string, number> = {};
      for (const e of exp ?? []) byCat[e.category || "Outros"] = (byCat[e.category || "Outros"] ?? 0) + (Number(e.amount) || 0);
      return {
        mes, mrr: brl(mrr), clientes_ativos: cl?.length ?? 0,
        faturas_pagas: brl(sum((inv ?? []).filter((i: any) => i.status === "pago"))),
        faturas_pendentes: brl(sum(pend.filter((i: any) => i.due_date >= today))),
        faturas_atrasadas: pend.filter((i: any) => i.due_date < today).map((i: any) => `${i.client_name} ${brl(Number(i.amount))} (venceu ${i.due_date})`),
        gastos_total: brl(sum(exp ?? [])),
        gastos_por_categoria: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, brl(v)])),
      };
    },
  },

  buscar_leads: {
    description: "Leads do CRM por etapa, responsável, nome/empresa, ou parados há X dias sem contato.",
    parameters: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Nome ou empresa" }, etapa: { type: "string" }, responsavel: { type: "string" },
        parados_dias: { type: "number", description: "Sem atualização há pelo menos N dias" },
      },
    },
    run: async (admin, a) => {
      let q = admin.from("leads").select("name, company, stage, closer, assignee, source, estimated_value, next_step, next_step_at, updated_at, created_at")
        .order("updated_at", { ascending: false }).limit(200);
      if (a.busca) q = q.or(`name.ilike.${like(a.busca)},company.ilike.${like(a.busca)}`);
      if (a.etapa) q = q.ilike("stage", like(a.etapa));
      if (a.parados_dias) q = q.lt("updated_at", new Date(Date.now() - a.parados_dias * 86_400_000).toISOString());
      const { data } = await q;
      let list = data ?? [];
      if (a.responsavel) { const r = a.responsavel.toLowerCase(); list = list.filter((l: any) => `${l.closer} ${l.assignee}`.toLowerCase().includes(r)); }
      const porEtapa: Record<string, number> = {};
      for (const l of list) porEtapa[l.stage || "Sem etapa"] = (porEtapa[l.stage || "Sem etapa"] ?? 0) + 1;
      return { total: list.length, por_etapa: porEtapa, leads: list.slice(0, 30) };
    },
  },

  gravacoes: {
    description: "Gravações agendadas num intervalo de datas (padrão: hoje até 7 dias).",
    parameters: { type: "object", properties: { de: { type: "string", description: "AAAA-MM-DD" }, ate: { type: "string", description: "AAAA-MM-DD" } } },
    run: async (admin, a) => {
      const { data } = await admin.from("shooting_schedules").select("title, shooting_date, start_time, end_time, location, status, client_id")
        .gte("shooting_date", a.de || spDay()).lte("shooting_date", a.ate || spDay(7)).order("shooting_date").limit(60);
      const names = await clientNames(admin, (data ?? []).map((s: any) => s.client_id).filter(Boolean));
      return { gravacoes: (data ?? []).map((s: any) => ({ ...s, client_id: undefined, cliente: names[s.client_id] ?? "" })) };
    },
  },

  carga_da_equipe: {
    description: "Por funcionário: tarefas abertas, atrasadas e para os próximos 7 dias.",
    parameters: { type: "object", properties: {} },
    run: async (admin) => {
      const today = spDay();
      const { data } = await admin.from("tasks").select("status, post_date, due_date, assignee, copywriter, script_writer, editor, videomaker, director")
        .is("deleted_at", null).gte("post_date", spDay(-30)).limit(2000);
      const out: Record<string, { abertas: number; atrasadas: number; proximos_7_dias: number }> = {};
      for (const t of (data ?? []).filter((t: any) => !DONE.test(String(t.status)))) {
        for (const p of new Set([t.assignee, t.copywriter, t.script_writer, t.editor, t.videomaker, t.director].filter(Boolean).map((x: string) => x.trim()))) {
          const o = (out[p] ??= { abertas: 0, atrasadas: 0, proximos_7_dias: 0 });
          o.abertas++;
          if (dateOf(t) < today) o.atrasadas++; else if (dateOf(t) <= spDay(7)) o.proximos_7_dias++;
        }
      }
      return out;
    },
  },
};

const SYSTEM = (name: string) => `Você é o assistente da plataforma da INOVA (agência de marketing e produtora), respondendo pelo WhatsApp para ${name || "o admin"}.
Hoje é ${spDay()} (horário de Brasília).
- Use as ferramentas para buscar os dados; nunca invente números, nomes ou datas. Se a ferramenta não trouxer, diga que não achou.
- Responda em português, curto e direto, no formato do WhatsApp: *negrito* com um asterisco, listas com "•", sem tabelas e sem markdown de títulos.
- Comece pela resposta (o número ou o nome), depois o detalhe. No máximo uns 15 itens; se tiver mais, diga quantos faltam.
- Datas no formato dd/mm. Você só consulta: não consegue criar, editar ou enviar nada; se pedirem, explique e diga onde fazer na plataforma.`;

/** Responde a pergunta usando as ferramentas (até 5 rodadas de consulta). */
export async function answerQuestion(admin: any, question: string, askerName: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "O assistente não está configurado (falta a chave LOVABLE_API_KEY no Lovable).";
  const tools = Object.entries(TOOLS).map(([name, t]) => ({ type: "function", function: { name, description: t.description, parameters: t.parameters } }));
  const messages: any[] = [{ role: "system", content: SYSTEM(askerName) }, { role: "user", content: question }];

  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, tools }),
    });
    if (res.status === 429) return "Muitas perguntas seguidas. Tente de novo em um minuto.";
    if (res.status === 402) return "Os créditos de IA do Lovable acabaram. Adicione créditos no workspace para eu voltar a responder.";
    if (!res.ok) return `Não consegui consultar a IA agora (erro ${res.status}).`;
    const msg = (await res.json())?.choices?.[0]?.message;
    if (!msg) return "Não consegui montar a resposta. Tente perguntar de outro jeito.";
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return String(msg.content || "").trim() || "Não achei nada sobre isso na plataforma.";
    messages.push(msg);
    for (const c of calls) {
      const tool = TOOLS[c.function?.name];
      let result: unknown;
      try {
        result = tool ? await tool.run(admin, JSON.parse(c.function.arguments || "{}")) : { erro: "Ferramenta desconhecida" };
      } catch (e) { result = { erro: String((e as Error).message) }; }
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 12000) });
    }
  }
  return "A pergunta ficou grande demais para uma resposta só. Tente dividir em partes.";
}

/** Manda a resposta pelo mesmo número que recebeu a pergunta */
export async function replyOnWhatsApp(session: string, to: string, text: string) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) return;
  await fetch(`${url}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
    body: JSON.stringify({ to, message: text.slice(0, 4000), session }),
  });
}
