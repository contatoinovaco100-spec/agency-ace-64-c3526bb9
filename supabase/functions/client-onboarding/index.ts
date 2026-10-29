// Onboarding do cliente pelo link público /bem-vindo/:token.
// O cliente não tem login na plataforma: cada ação é autorizada pelo token do onboarding,
// e esta função (service role) só toca nos dados do cliente dono daquele token.
// Etapa 3: dados de acesso vão para a planilha (INOVA_ACCESS_SHEET_URL) e o cliente marca a ligação do código.
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

const STEPS = ["briefing", "instagram", "access", "materials", "kickoff"] as const;
type Step = typeof STEPS[number];

// Campos do briefing aceitos (os mesmos da tabela client_briefings)
const BRIEFING_FIELDS = [
  "company_name", "responsible_name", "phone", "segment", "instagram", "goals_3_months",
  "target_age_range", "target_gender", "audience_pain_points", "audience_desires",
  "purchase_triggers", "purchase_blockers", "current_perception", "desired_perception",
  "differentials", "competitors", "communication_style", "things_to_avoid", "monthly_revenue",
];

// Ligação para o cliente passar o código de verificação do Instagram:
// seg a sex, das 10h às 12h (horário de Brasília), de amanhã até 14 dias à frente
const CALL_TIMES = ["10:00", "10:30", "11:00", "11:30"];
const CALL_DAYS_AHEAD = 14;

function upcomingCallSlots(): string[] {
  // Brasília não tem mais horário de verão: UTC-3 o ano todo
  const today = new Date(Date.now() - 3 * 3600_000);
  const slots: string[] = [];
  for (let i = 1; i <= CALL_DAYS_AHEAD; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const day = d.toISOString().slice(0, 10);
    CALL_TIMES.forEach((t) => slots.push(new Date(`${day}T${t}:00-03:00`).toISOString()));
  }
  return slots;
}

const formatCall = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

// Planilha do Google (Apps Script publicado como app da Web) que recebe os acessos do Instagram.
// A senha vai só para a planilha: não é gravada no banco da plataforma.
const ACCESS_SHEET_URL = Deno.env.get("INOVA_ACCESS_SHEET_URL") || "";

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
    // Além da data de cada etapa, guarda o horário marcado da ligação em `access_call_at`
    const steps = (onboarding.steps ?? {}) as Partial<Record<Step | "access_call_at", string>>;

    // Marca etapas como concluídas e recalcula o status geral
    const markSteps = async (done: Step[], extra: Record<string, unknown> = {}, extraSteps: typeof steps = {}) => {
      const now = new Date().toISOString();
      const next = { ...steps, ...extraSteps };
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

    // Horários livres: tira os que outro cliente já marcou
    const freeCallSlots = async () => {
      const slots = upcomingCallSlots();
      const { data: booked } = await admin
        .from("client_onboardings")
        .select("id, steps")
        .gte("steps->>access_call_at", slots[0] ?? new Date().toISOString())
        .neq("id", onboarding.id);
      const taken = new Set((booked ?? []).map((b) => (b.steps as Record<string, string>)?.access_call_at));
      return slots.filter((s) => !taken.has(s));
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
        // ID do Business Manager da INOVA (o segredo, se existir, tem prioridade)
        access_call_at: steps.access_call_at ?? null,
        call_slots: await freeCallSlots(),
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

    if (action === "access") {
      const slot = String(body.slot || "");
      if (!(await freeCallSlots()).includes(slot)) {
        return json({ error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." }, 409);
      }
      const form = body.form as Record<string, unknown> | undefined;
      const field = (k: string, max = 200) => String(form?.[k] ?? "").trim().slice(0, max);

      if (form) {
        const row = {
          cliente: onboarding.clients?.company_name ?? "",
          instagram: field("instagram").replace(/^@/, ""),
          senha: field("password"),
          contato_codigo: field("code_contact"),
          responsavel: field("responsible"),
          whatsapp: field("whatsapp", 40),
          ligacao: formatCall(slot),
          observacoes: field("notes", 1000),
        };
        if (!row.instagram || !row.senha || !row.contato_codigo || !row.responsavel || !row.whatsapp) {
          return json({ error: "Preencha todos os campos obrigatórios." }, 400);
        }
        if (!ACCESS_SHEET_URL) {
          console.error("client-onboarding: INOVA_ACCESS_SHEET_URL não configurado");
          return json({ error: "Não conseguimos registrar agora. Fale com a equipe da INOVA pelo WhatsApp." }, 500);
        }
        const res = await fetch(ACCESS_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(row),
        }).catch((e) => { console.error("client-onboarding sheet error", e); return null; });
        if (!res?.ok) {
          console.error("client-onboarding sheet status", res?.status);
          return json({ error: "Não conseguimos registrar agora. Tente de novo em instantes." }, 502);
        }
      } else if (!steps.access) {
        return json({ error: "Preencha os dados do Instagram." }, 400);
      }

      const next = await markSteps(["access"], {}, { access_call_at: slot });
      return json({ success: true, steps: next, access_call_at: slot });
    }

    if (action === "step") {
      const step = String(body.step || "") as Step;
      if (!["materials", "kickoff"].includes(step)) return json({ error: "Etapa inválida" }, 400);
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
