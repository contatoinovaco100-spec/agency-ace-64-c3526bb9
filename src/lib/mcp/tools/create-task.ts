import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description:
    "Cria uma tarefa no kanban da agência, opcionalmente vinculada a um cliente. A tarefa entra na etapa inicial do fluxo.",
  inputSchema: {
    title: z.string().min(1).describe("Título da tarefa."),
    client_id: z
      .string()
      .uuid()
      .optional()
      .describe("Id do cliente relacionado (veja list_clients)."),
    description: z.string().optional().describe("Descrição ou briefing da tarefa."),
    task_type: z
      .string()
      .optional()
      .describe("Tipo da tarefa (ex.: arte, video, reuniao)."),
    priority: z
      .enum(["baixa", "media", "alta"])
      .optional()
      .describe("Prioridade: baixa, media ou alta."),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data de entrega no formato AAAA-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, client_id, description, task_type, priority, due_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    if (client_id) {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", client_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (clientError) {
        return { content: [{ type: "text" as const, text: clientError.message }], isError: true };
      }
      if (!client) throw new ToolError("Cliente não encontrado.");
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title,
        client_id: client_id ?? null,
        description: description ?? "",
        task_type: task_type ?? "arte",
        priority: priority ?? "media",
        due_date: due_date ?? null,
      })
      .select("id, title, status, client_id, due_date")
      .single();
    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }

    const task = {
      id: data.id,
      title: data.title,
      status: data.status,
      client_id: data.client_id,
      due_date: data.due_date,
    };
    return {
      content: [{ type: "text" as const, text: `Tarefa criada: ${task.title} (${task.id})` }],
      structuredContent: { task },
    };
  },
});
