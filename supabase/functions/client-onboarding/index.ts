// Onboarding do cliente pelo link público /bem-vindo/:token.
// O cliente não tem login na plataforma: cada ação é autorizada pelo token do onboarding,
// e esta função (service role) só toca nos dados do cliente dono daquele token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAdapter } from "../_shared/platforms/registry.ts";
import { saveConnectedAccounts } from "../_shared/save-social-accounts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const STEPS = ["briefing", "instagram", "meta_partner", "materials", "kickoff"] as const;
type Step = typeof STEPS[number];

// Campos do briefing aceitos (os mesmos da tabela client_briefings)
const BRIEFING_FIELDS = [
  "company_name", "responsible_name", "phone", "segment", "instagram", "goals_3_months",
  "target_age_range", "target_gender", "audience_pain_points", "audience_desires",
  "purchase_triggers", "purchase_blockers", "current_perception", "desired_perception",
  "differentials", "competitors", "communication_style", "things_to_avoid", "monthly_revenue",
];

// O Meta só aceita voltar do login para endereços cadastrados no app: usamos o mesmo da equipe
const ALLOWED_REDIRECTS = ["https://inovamarketing.online/redes-sociais"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const token = String(body.token || "").trim();
    if (!/^[a-f0-9]{24,64}$/i.test(token)) return json({ error: "Link inválido" }, 400);

    const { data: onboarding } = await admin
      .from("client_onboardings")
      .select("*, clients(id, company_name, contact_name)")
      .eq("token", token)
      .maybeSingle();
    if (!onboarding) return json({ error: "Link de onboarding não encontrado ou expirado" }, 404);

    const clientId = onboarding.client_id as string;
    const steps = (onboarding.steps ?? {}) as Partial<Record<Step, string>>;

    // Marca etapas como concluídas e recalcula o status geral
    const markSteps = async (done: Step[], extra: Record<string, unknown> = {}) => {
      const now = new Date().toISOString();
      const next = { ...steps };
      done.forEach((s) => { next[s] = next[s] ?? now; });
      const complete = STEPS.every((s) => next[s]);
      await admin.from("client_onboardings").update({
        ...extra,
        steps: next,
        status: complete ? "concluido" : "em_andamento",
        updated_at: now,
      }).eq("id", onboarding.id);
      return next;
    };

    if (action === "get") {
      const { data: accounts } = await admin
        .from("social_accounts")
        .select("username, platform, profile_picture")
        .eq("client_id", clientId);
      return json({
        client_name: onboarding.clients?.company_name ?? "",
        contact_name: onboarding.clients?.contact_name ?? "",
        status: onboarding.status,
        steps,
        materials_url: onboarding.materials_url,
        kickoff_preference: onboarding.kickoff_preference,
        meta_business_id: Deno.env.get("INOVA_META_BUSINESS_ID") ?? "",
        accounts: accounts ?? [],
      });
    }

    if (action === "auth_url") {
      const redirectUri = String(body.redirect_uri || "");
      if (!ALLOWED_REDIRECTS.includes(redirectUri)) return json({ error: "Endereço de retorno não permitido" }, 400);
      const adapter = getAdapter("instagram");
      // O state leva o token para a página de retorno saber de qual onboarding é o login
      return json({ url: adapter.authUrl(redirectUri, `onb.${token}`) });
    }

    if (action === "connect") {
      const redirectUri = String(body.redirect_uri || "");
      if (!ALLOWED_REDIRECTS.includes(redirectUri)) return json({ error: "Endereço de retorno não permitido" }, 400);
      const adapter = getAdapter("instagram");
      let accounts;
      try {
        accounts = await adapter.exchangeCode(String(body.code || ""), redirectUri);
      } catch (e) {
        console.error("client-onboarding connect error", e);
        return json({ error: "Não foi possível concluir o login com o Facebook. Tente de novo." }, 400);
      }
      if (!accounts.length) {
        return json({
          error: "Nenhuma conta do Instagram encontrada. Confira se o Instagram é profissional e está ligado a uma página do Facebook.",
        }, 400);
      }
      const saved = await saveConnectedAccounts(admin, "instagram", accounts, { createdBy: null, clientId });
      const next = await markSteps(["instagram"]);
      return json({ success: true, accounts: saved, steps: next });
    }

    if (action === "briefing") {
      const data = (body.data ?? {}) as Record<string, unknown>;
      const row: Record<string, unknown> = { client_id: clientId, status: "novo" };
      BRIEFING_FIELDS.forEach((f) => { row[f] = String(data[f] ?? "").slice(0, 5000); });
      const { error } = await admin.from("client_briefings").insert(row);
      if (error) return json({ error: error.message }, 500);
      const next = await markSteps(["briefing"]);
      return json({ success: true, steps: next });
    }

    if (action === "step") {
      const step = String(body.step || "") as Step;
      if (!["meta_partner", "materials", "kickoff"].includes(step)) return json({ error: "Etapa inválida" }, 400);
      const extra: Record<string, unknown> = {};
      if (step === "materials") extra.materials_url = String(body.materials_url || "").slice(0, 1000);
      if (step === "kickoff") extra.kickoff_preference = String(body.kickoff_preference || "").slice(0, 500);
      const next = await markSteps([step], extra);
      return json({ success: true, steps: next });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("client-onboarding error", e);
    return json({ error: "Erro inesperado. Tente de novo em instantes." }, 500);
  }
});
