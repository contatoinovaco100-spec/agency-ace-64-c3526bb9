import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toTaskJson = (row: {
  id: string;
  title: string;
  status: string;
  task_type: string;
  priority: string;
  due_date: string | null;
  post_date: string | null;
  client_id: string | null;
  assignee: string;
}) => ({
  id: row.id,
  title: row.title,
  status: row.status,
  task_type: row.task_type,
  priority: row.priority,
  due_date: row.due_date,
  post_date: row.post_date,
  client_id: row.client_id,
  assignee: row.assignee,
});

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description:
    "Lista tarefas do kanban da agência, com título, etapa, prioridade e datas. Filtre por cliente ou etapa.",
  inputSchema: {
    client_id: z
      .string()
      .uuid()
      .optional()
      .describe("Id do cliente (veja list_clients) para ver só as tarefas dele."),
    status: z
      .string()
      .optional()
      .describe("Filtrar por etapa do kanban (ex.: a_fazer, em_andamento, concluido)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Quantidade máxima de tarefas retornadas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, status, task_type, priority, due_date, post_date, client_id, assignee")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (client_id) query = query.eq("client_id", client_id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    const tasks = (data ?? []).map(toTaskJson);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
      structuredContent: { tasks },
    };
  },
});
