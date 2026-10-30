// Captura de leads de fora (formulários do site, quiz, landing pages): POST com { token, name, phone,
// email?, company?, source?, notes? }. O token fica no segredo CRM_CAPTURE_TOKEN.
// Cria o lead com dono pelo rodízio de vendedores e inscreve nas sequências automáticas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createLead, findLeadByPhone, normalizePhone } from "../_shared/crm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const b = await req.json().catch(() => ({}));
    const expected = Deno.env.get("CRM_CAPTURE_TOKEN");
    if (!expected || b.token !== expected) return json({ error: "Token inválido" }, 401);
    const name = String(b.name ?? "").trim().slice(0, 120);
    const phone = normalizePhone(b.phone);
    if (!name || !phone) return json({ error: "Informe nome e telefone" }, 400);

    const existing = await findLeadByPhone(admin, phone);
    if (existing) return json({ ok: true, lead_id: existing.id, existing: true });
    const lead = await createLead(admin, {
      name, phone, email: String(b.email ?? "").slice(0, 160), company: String(b.company ?? "").slice(0, 160),
      source: String(b.source ?? "Formulário").slice(0, 60), notes: String(b.notes ?? "").slice(0, 2000),
    });
    return json({ ok: true, lead_id: lead.id, owner: lead.assignee });
  } catch (e) {
    console.error("crm-capture error", e);
    return json({ error: "Não foi possível registrar" }, 500);
  }
});
