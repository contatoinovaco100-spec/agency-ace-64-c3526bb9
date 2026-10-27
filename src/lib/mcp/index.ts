import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listTasksTool from "./tools/list-tasks";
import getClientTool from "./tools/get-client";
import createTaskTool from "./tools/create-task";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "plataforma-inova",
  title: "Plataforma Inova",
  version: "0.1.0",
  instructions:
    "Ferramentas da Plataforma Inova (CRM interno da agência INOVA Co.). Use list_clients para encontrar clientes, get_client para detalhes, list_tasks para ver tarefas do kanban e create_task para criar tarefas. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClientsTool, listTasksTool, getClientTool, createTaskTool],
});
