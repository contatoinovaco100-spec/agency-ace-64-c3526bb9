import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_client",
  title: "Detalhes do cliente",
  description:
    "Mostra os detalhes de um cliente pelo id: contato, situação, valor mensal, escopo e quantidade de tarefas abertas.",
  inputSchema: {
    id: z.string().uuid().describe("Id do cliente (veja list_clients)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, company_name, contact_name, email, phone, status, monthly_value, service_type, scope, contract_start_date, notes",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    if (!data) throw new ToolError("Cliente não encontrado.");

    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id)
      .is("deleted_at", null)
      .neq("status", "concluido");

    const client = {
      id: data.id,
      company_name: data.company_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      status: data.status,
      monthly_value: data.monthly_value,
      service_type: data.service_type,
      scope: data.scope,
      contract_start_date: data.contract_start_date,
      notes: data.notes,
      open_tasks: count ?? 0,
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(client, null, 2) }],
      structuredContent: { client },
    };
  },
});
