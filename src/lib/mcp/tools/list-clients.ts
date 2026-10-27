import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toClientJson = (row: {
  id: string;
  company_name: string;
  contact_name: string;
  status: string;
  monthly_value: number;
  service_type: string[];
}) => ({
  id: row.id,
  company_name: row.company_name,
  contact_name: row.contact_name,
  status: row.status,
  monthly_value: row.monthly_value,
  service_type: row.service_type,
});

export default defineTool({
  name: "list_clients",
  title: "Listar clientes",
  description:
    "Lista os clientes ativos da agência, com nome da empresa, contato, situação e valor mensal. Use para encontrar o id de um cliente.",
  inputSchema: {
    search: z
      .string()
      .optional()
      .describe("Trecho do nome da empresa ou do contato para filtrar."),
    status: z
      .string()
      .optional()
      .describe("Filtrar por situação do cliente (ex.: ativo, cancelado)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Quantidade máxima de clientes retornados (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, company_name, contact_name, status, monthly_value, service_type")
      .is("deleted_at", null)
      .order("company_name", { ascending: true })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    const clients = (data ?? []).map(toClientJson);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(clients, null, 2) }],
      structuredContent: { clients },
    };
  },
});
