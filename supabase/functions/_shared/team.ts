import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Só a equipe da INOVA passa: admin ou quem tem alguma página liberada em Funcionários.
 * Conta criada pelo "Cadastrar", afiliado, cliente do portal ou empresa da Rede não passa,
 * mesmo estando logada. Devolve o id do usuário, ou null.
 */
export async function teamUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await admin.auth.getUser(token);
  const id = data?.user?.id;
  if (!id) return null;
  const [{ data: role }, { data: page }] = await Promise.all([
    admin.from("user_roles").select("user_id").eq("user_id", id).eq("role", "admin").limit(1),
    admin.from("user_page_access").select("user_id").eq("user_id", id).limit(1),
  ]);
  return (role?.length || page?.length) ? id : null;
}

export function forbidden(cors: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Acesso só para a equipe da INOVA" }), {
    status: 403, headers: { ...cors, "Content-Type": "application/json" },
  });
}
