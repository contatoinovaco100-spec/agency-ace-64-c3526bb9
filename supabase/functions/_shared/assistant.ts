// Assistente da plataforma no WhatsApp: responde só no grupo escolhido em Administração → Assistente do WhatsApp.
// Consulta os dados (tarefas, clientes, CRM, financeiro, gravações, equipe) e, se permitido, executa ações
// (criar/mover card, lead, gravação, gasto, fatura paga, aviso do kanban). Entende texto e áudio. Nunca apaga nada.
// Chamado pelo wa-inbound; cada pedido fica em wa_assistant_log.
// deno-lint-ignore-file no-explicit-any
import { createLead } from "./crm.ts";

const DONE = /postado|publicado|conclu|programado|finalizado|arquivad/i;
const spNow = () => new Date(Date.now() - 3 * 3_600_000);
const spDay = (offset = 0) => new Date(spNow().getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const like = (s: string) => `%${s.trim().replace(/[%_,()]/g, " ")}%`;
const dateOf = (t: any) => String(t.post_date || t.due_date || "");
const people = (t: any) => [t.assignee, t.copywriter, t.script_writer, t.editor, t.videomaker, t.director].filter(Boolean).join(", ");

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

// ─── Ações (escrevem na plataforma) ───────────────────────────────────────────
// Mesmo nome do kanban na tela → valor gravado no banco (src/lib/taskStatus.ts)
const UI_TO_DB: Record<string, string> = {
  "Ideias / Backlog": "A fazer", "Em Copy": "Em copy", "Em Direção": "Em direção", "Em Gravação": "Em gravação", "Em Edição": "Em edição",
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

async function stageNamed(admin: any, board: "tasks" | "crm", name: string) {
  const { data } = await admin.from("kanban_stages").select("name").eq("board", board).order("position");
  const list = ((data ?? []) as { name: string }[]).map((x) => x.name);
  const hit = list.find((x) => norm(x) === norm(name)) ?? list.find((x) => norm(x).includes(norm(name)));
  return { hit: hit ?? null, list };
}

async function oneClient(admin: any, name: string) {
  const cs = (await clientIds(admin, name)) ?? [];
  const exact = cs.find((c) => norm(c.company_name) === norm(name));
  if (exact || cs.length === 1) return { client: exact ?? cs[0] };
  return { erro: cs.length ? `Mais de um cliente com "${name}": ${cs.map((c) => c.company_name).join(", ")}. Qual?` : `Nenhum cliente com "${name}".` };
}

const DATE = { type: "string", description: "AAAA-MM-DD (converta 'amanhã', 'sexta' etc. para a data)" };
const ACTIONS: typeof TOOLS = {
  criar_tarefa: {
    description: "Cria um card no kanban de tarefas.",
    parameters: {
      type: "object", required: ["titulo", "cliente"],
      properties: {
        titulo: { type: "string" }, cliente: { type: "string" }, tipo: { type: "string", enum: ["video", "arte"] },
        responsavel: { type: "string" }, entrega: DATE, data_postar: DATE, hora_postar: { type: "string", description: "HH:MM" },
        etapa: { type: "string" }, descricao: { type: "string" },
      },
    },
    run: async (admin, a) => {
      const c = await oneClient(admin, a.cliente);
      if (!c.client) return { erro: c.erro };
      let status = "A fazer";
      if (a.etapa) { const st = await stageNamed(admin, "tasks", a.etapa); if (!st.hit) return { erro: `Etapa "${a.etapa}" não existe. Etapas: ${st.list.join(", ")}` }; status = UI_TO_DB[st.hit] ?? st.hit; }
      const { data, error } = await admin.from("tasks").insert({
        title: a.titulo, video_name: a.titulo, client_id: c.client.id, task_type: a.tipo || "video", priority: "media", status,
        assignee: a.responsavel || "", description: a.descricao || "", due_date: a.entrega || null, post_date: a.data_postar || null,
        post_time: a.hora_postar || null,
      }).select("id").single();
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Card "${a.titulo}" criado para ${c.client.company_name}`, id: data.id };
    },
  },

  atualizar_tarefa: {
    description: "Muda um card existente: etapa (mover), responsável, data/hora de postar ou entrega. Ache o card pelo título.",
    parameters: {
      type: "object", required: ["busca"],
      properties: {
        busca: { type: "string", description: "Parte do título do card" }, cliente: { type: "string" },
        etapa: { type: "string" }, responsavel: { type: "string" }, data_postar: DATE, hora_postar: { type: "string" }, entrega: DATE,
      },
    },
    run: async (admin, a) => {
      let q = admin.from("tasks").select("id, title, video_name, status, client_id").is("deleted_at", null)
        .or(`title.ilike.${like(a.busca)},video_name.ilike.${like(a.busca)}`).order("updated_at", { ascending: false }).limit(10);
      if (a.cliente) { const cs = (await clientIds(admin, a.cliente)) ?? []; if (!cs.length) return { erro: `Nenhum cliente com "${a.cliente}"` }; q = q.in("client_id", cs.map((c) => c.id)); }
      const { data } = await q;
      const open = (data ?? []).filter((t: any) => !DONE.test(String(t.status)));
      const found = open.length ? open : (data ?? []);
      if (found.length !== 1) return { erro: found.length ? `Achei ${found.length} cards: ${found.map((t: any) => `"${t.video_name || t.title}"`).join(", ")}. Qual?` : `Nenhum card com "${a.busca}".` };
      const t = found[0];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (a.etapa) { const st = await stageNamed(admin, "tasks", a.etapa); if (!st.hit) return { erro: `Etapa "${a.etapa}" não existe. Etapas: ${st.list.join(", ")}` }; patch.status = UI_TO_DB[st.hit] ?? st.hit; }
      if (a.responsavel) patch.assignee = a.responsavel;
      if (a.data_postar) patch.post_date = a.data_postar;
      if (a.hora_postar) patch.post_time = a.hora_postar;
      if (a.entrega) patch.due_date = a.entrega;
      const { error } = await admin.from("tasks").update(patch).eq("id", t.id);
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Card "${t.video_name || t.title}" atualizado (${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")})` };
    },
  },

  criar_lead: {
    description: "Cadastra um lead novo no CRM (entra na primeira etapa e no rodízio de vendedores).",
    parameters: { type: "object", required: ["nome"], properties: { nome: { type: "string" }, empresa: { type: "string" }, telefone: { type: "string" }, observacao: { type: "string" } } },
    run: async (admin, a) => {
      const lead = await createLead(admin, { name: a.nome, company: a.empresa || "", phone: a.telefone ? String(a.telefone).replace(/\D/g, "") : null, source: "Assistente WhatsApp", notes: a.observacao || "" });
      return { ok: true, resumo: `Lead ${a.nome}${a.empresa ? ` (${a.empresa})` : ""} criado, com ${lead.assignee || "a equipe"}` };
    },
  },

  mover_lead: {
    description: "Muda a etapa de um lead do CRM.",
    parameters: { type: "object", required: ["busca", "etapa"], properties: { busca: { type: "string", description: "Nome ou empresa" }, etapa: { type: "string" } } },
    run: async (admin, a) => {
      const { data } = await admin.from("leads").select("id, name, company").or(`name.ilike.${like(a.busca)},company.ilike.${like(a.busca)}`).limit(6);
      if ((data ?? []).length !== 1) return { erro: data?.length ? `Achei ${data.length} leads: ${data.map((l: any) => l.company || l.name).join(", ")}. Qual?` : `Nenhum lead com "${a.busca}".` };
      const st = await stageNamed(admin, "crm", a.etapa);
      if (!st.hit) return { erro: `Etapa "${a.etapa}" não existe. Etapas: ${st.list.join(", ")}` };
      const { error } = await admin.from("leads").update({ stage: st.hit, updated_at: new Date().toISOString() }).eq("id", data[0].id);
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Lead ${data[0].company || data[0].name} movido para ${st.hit}` };
    },
  },

  agendar_gravacao: {
    description: "Agenda uma gravação na agenda de gravações.",
    parameters: {
      type: "object", required: ["cliente", "data"],
      properties: { cliente: { type: "string" }, data: DATE, hora: { type: "string", description: "HH:MM" }, hora_fim: { type: "string" }, local: { type: "string" }, titulo: { type: "string" } },
    },
    run: async (admin, a) => {
      const c = await oneClient(admin, a.cliente);
      if (!c.client) return { erro: c.erro };
      const { error } = await admin.from("shooting_schedules").insert({
        title: a.titulo || `Gravação ${c.client.company_name}`, client_id: c.client.id, shooting_date: a.data,
        start_time: a.hora || null, end_time: a.hora_fim || null, location: a.local || "",
      });
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Gravação de ${c.client.company_name} em ${a.data}${a.hora ? ` às ${a.hora}` : ""}` };
    },
  },

  registrar_gasto: {
    description: "Lança um gasto da INOVA (Dashboard → Gastos).",
    parameters: { type: "object", required: ["valor", "descricao"], properties: { valor: { type: "number" }, descricao: { type: "string" }, categoria: { type: "string" }, data: DATE } },
    run: async (admin, a) => {
      const day = a.data || spDay();
      const row = { type: "gasto", amount: Number(a.valor), description: a.descricao, category: a.categoria || "Outros", month_ref: `${day.slice(0, 7)}-01`, spent_on: day, recurring: false };
      let { error } = await admin.from("expenses").insert(row);
      if (error && /spent_on|recurring/.test(error.message)) { const { spent_on: _d, recurring: _r, ...rest } = row; ({ error } = await admin.from("expenses").insert(rest)); }
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Gasto de ${brl(Number(a.valor))} (${a.descricao})` };
    },
  },

  marcar_fatura_paga: {
    description: "Marca como paga a fatura pendente mais antiga de um cliente.",
    parameters: { type: "object", required: ["cliente"], properties: { cliente: { type: "string" }, valor: { type: "number", description: "Para escolher a fatura certa se houver várias" } } },
    run: async (admin, a) => {
      let q = admin.from("invoices").select("id, client_name, amount, due_date").eq("status", "pendente").ilike("client_name", like(a.cliente)).order("due_date").limit(5);
      if (a.valor) q = q.eq("amount", a.valor);
      const { data } = await q;
      if (!data?.length) return { erro: `Nenhuma fatura pendente de "${a.cliente}".` };
      const inv = data[0];
      const { error } = await admin.from("invoices").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", inv.id);
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Fatura de ${inv.client_name} (${brl(Number(inv.amount))}, venc. ${inv.due_date}) marcada como paga` };
    },
  },

  publicar_aviso: {
    description: "Publica um aviso no topo do kanban de todo mundo.",
    parameters: {
      type: "object", required: ["titulo"],
      properties: { titulo: { type: "string" }, mensagem: { type: "string" }, tom: { type: "string", enum: ["destaque", "aviso", "urgente"] }, ate: DATE },
    },
    run: async (admin, a) => {
      const { error } = await admin.from("kanban_notices").insert({ title: a.titulo, message: a.mensagem || "", tone: a.tom || "destaque", ends_on: a.ate || null, created_by: "Assistente WhatsApp" });
      if (error) return { erro: error.message };
      return { ok: true, resumo: `Aviso "${a.titulo}" publicado no kanban` };
    },
  },
};

const SYSTEM = (name: string) => `Você é o assistente da plataforma da INOVA (agência de marketing e produtora), respondendo pelo WhatsApp para ${name || "o admin"}.
Hoje é ${spDay()} (horário de Brasília).
- Use as ferramentas para buscar os dados; nunca invente números, nomes ou datas. Se a ferramenta não trouxer, diga que não achou.
- Responda em português, curto e direto, no formato do WhatsApp: *negrito* com um asterisco, listas com "•", sem tabelas e sem markdown de títulos.
- Comece pela resposta (o número ou o nome), depois o detalhe. No máximo uns 15 itens; se tiver mais, diga quantos faltam.
- Datas no formato dd/mm.`;
const RULES_ACTIONS = `
- Você pode executar ações com as ferramentas de ação. Só execute o que foi pedido claramente; se faltar um dado obrigatório ou a ferramenta pedir para escolher, pergunte em uma linha.
- Depois de executar, confirme em uma linha o que foi feito. Você não apaga nada e não manda mensagem para clientes.`;
const RULES_READONLY = `
- Você só consulta: ações estão desligadas em Administração → Assistente do WhatsApp. Se pedirem uma ação, diga isso e onde fazer na plataforma.`;

export type AssistantInput = { text: string; audio?: { base64: string; mimetype: string } | null };
export type AssistantAction = { tool: string; ok: boolean; resumo: string };

/** Responde o pedido (texto ou áudio) usando as ferramentas, em até 6 rodadas. Devolve a resposta e as ações feitas. */
export async function answerQuestion(admin: any, input: AssistantInput, askerName: string, allowActions: boolean): Promise<{ answer: string; actions: AssistantAction[] }> {
  const actions: AssistantAction[] = [];
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { answer: "O assistente não está configurado (falta a chave LOVABLE_API_KEY no Lovable).", actions };
  const all = allowActions ? { ...TOOLS, ...ACTIONS } : TOOLS;
  const tools = Object.entries(all).map(([name, t]) => ({ type: "function", function: { name, description: t.description, parameters: t.parameters } }));
  const user = input.audio
    ? [{ type: "text", text: "Pedido por áudio (ouça e atenda):" }, { type: "input_audio", input_audio: { data: input.audio.base64, format: input.audio.mimetype.includes("mpeg") ? "mp3" : "ogg" } }]
    : input.text;
  const messages: any[] = [{ role: "system", content: SYSTEM(askerName) + (allowActions ? RULES_ACTIONS : RULES_READONLY) }, { role: "user", content: user }];
  const done = (answer: string) => ({ answer, actions });

  for (let round = 0; round < 6; round++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, tools }),
    });
    if (res.status === 429) return done("Muitos pedidos seguidos. Tente de novo em um minuto.");
    if (res.status === 402) return done("Os créditos de IA do Lovable acabaram. Adicione créditos no workspace para eu voltar a responder.");
    if (!res.ok) {
      console.error("assistant gateway", res.status, await res.text().catch(() => ""));
      return done(input.audio ? "Não consegui ouvir esse áudio. Pode mandar por escrito?" : `Não consegui consultar a IA agora (erro ${res.status}).`);
    }
    const msg = (await res.json())?.choices?.[0]?.message;
    if (!msg) return done("Não consegui montar a resposta. Tente pedir de outro jeito.");
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return done(String(msg.content || "").trim() || "Não achei nada sobre isso na plataforma.");
    messages.push(msg);
    for (const c of calls) {
      const name = c.function?.name;
      const tool = all[name];
      let result: any;
      try {
        result = tool ? await tool.run(admin, JSON.parse(c.function.arguments || "{}")) : { erro: "Ferramenta desconhecida" };
      } catch (e) { result = { erro: String((e as Error).message) }; }
      if (name in ACTIONS) actions.push({ tool: name, ok: !!result?.ok, resumo: result?.resumo ?? result?.erro ?? "" });
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 12000) });
    }
  }
  return done("O pedido ficou grande demais para uma resposta só. Tente dividir em partes.");
}

/** Áudio de uma mensagem recente, baixado do servidor do WhatsApp */
export async function fetchAudio(session: string, messageId: string) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) return null;
  const res = await fetch(`${url}/media/${encodeURIComponent(messageId)}?session=${encodeURIComponent(session)}`, {
    headers: { "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
  });
  if (!res.ok) return null;
  const d = await res.json().catch(() => null);
  return d?.base64 ? { base64: String(d.base64), mimetype: String(d.mimetype || "audio/ogg") } : null;
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
