// Prospecção automática pelo WhatsApp.
// - action "search" (login): busca empresas da campanha no Google (Places API oficial) e coloca na fila.
// - action "sample" (login): a IA escreve uma mensagem de exemplo para a campanha, sem enviar.
// - action "run" (cron a cada 5 min, sem login): para cada campanha ligada, no horário e dentro do limite do dia,
//   confere se o número tem WhatsApp, a IA escreve a mensagem e envia 1 por vez com intervalo aleatório.
// A resposta do prospect é tratada no wa-inbound (vira lead, ou "não quer" se pedir para parar).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { findClientByPhone, findLeadByPhone, normalizePhone, recordMessage, upsertConversation } from "../_shared/crm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Campaign = {
  id: string; name: string; niche: string; city: string; session_id: string | null; pitch: string; example_message: string;
  daily_limit: number; min_gap_min: number; max_gap_min: number; start_hour: number; end_hour: number;
  weekdays_only: boolean; active: boolean; next_send_at: string | null;
};
type Prospect = { id: string; name: string; phone: string; message?: string; address: string; category: string; rating: number | null; reviews: number | null; website: string };

const spNow = () => new Date(Date.now() - 3 * 3_600_000);
const spDayStartUtc = () => new Date(spNow().toISOString().slice(0, 10) + "T03:00:00Z").toISOString();

// ─── Google Places (Text Search, API nova) ───────────────────────────────────
const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.rating", "places.userRatingCount", "places.websiteUri", "places.googleMapsUri", "places.primaryTypeDisplayName",
  "places.businessStatus", "nextPageToken",
].join(",");

async function searchPlaces(query: string, pages = 3) {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("Cadastre o segredo GOOGLE_PLACES_API_KEY no Lovable");
  const places: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < pages; i++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, pageToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google: ${data?.error?.message ?? res.status}`);
    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 1500)); // o Google pede um intervalo antes de usar o token
  }
  return places;
}

// ─── Mensagem escrita pela IA ────────────────────────────────────────────────
async function writeMessage(c: Campaign, p: Pick<Prospect, "name" | "category" | "address" | "rating" | "reviews" | "website">) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  const system = [
    "Você escreve a PRIMEIRA mensagem de WhatsApp de uma agência de marketing para uma empresa local que ainda não a conhece.",
    "Regras: português do Brasil, tom humano e simples, como uma pessoa escrevendo do celular (nada de texto de anúncio).",
    "Até 450 caracteres, 2 ou 3 parágrafos curtos, no máximo 1 emoji. Cite o nome da empresa e um detalhe real dela (ramo, bairro/cidade ou avaliação no Google).",
    "Sem links, sem preços, sem promessas de resultado. Termine com uma pergunta leve que dê para responder com sim ou não.",
    "Na última linha, de forma gentil, diga que se não fizer sentido é só avisar que não manda mais mensagens.",
    "Responda só com o texto da mensagem.",
  ].join("\n");
  const user = [
    `O que a agência oferece / instruções: ${c.pitch || "gestão de redes sociais e produção de vídeos para empresas locais"}`,
    c.example_message ? `Mensagem de referência (mantenha a ideia, mas escreva diferente):\n${c.example_message}` : "",
    `Empresa: ${p.name}`,
    p.category ? `Ramo: ${p.category}` : "",
    p.address ? `Endereço: ${p.address}` : "",
    p.rating ? `Avaliação no Google: ${p.rating} (${p.reviews ?? 0} avaliações)` : "",
    p.website ? "Tem site." : "Não tem site cadastrado no Google.",
  ].filter(Boolean).join("\n");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`IA: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "");
  if (!text) throw new Error("A IA não devolveu mensagem");
  return text.slice(0, 1200);
}

// ─── Servidor do WhatsApp ────────────────────────────────────────────────────
async function wa(path: string, body: unknown) {
  const url = Deno.env.get("WA_SERVER_URL");
  if (!url) throw new Error("WA_SERVER_URL não configurado");
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("WA_API_KEY") ?? "" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Servidor do WhatsApp: ${res.status}`);
  return data;
}

/** Já é cliente, lead ou já conversou com a gente: não prospecta */
async function alreadyKnown(admin: any, phone: string) {
  if (await findClientByPhone(admin, phone)) return "já é cliente";
  if (await findLeadByPhone(admin, phone)) return "já é lead";
  const { data } = await admin.from("wa_conversations").select("id").ilike("contact_phone", `%${phone.slice(-8)}`).limit(1);
  return data?.length ? "já conversou no WhatsApp" : null;
}

// ─── Envio: 1 mensagem por campanha a cada rodada, respeitando horário, limite e intervalo ─
async function runCampaign(admin: any, c: Campaign) {
  const now = spNow();
  const dow = now.getUTCDay(), hour = now.getUTCHours();
  if (c.weekdays_only && (dow === 0 || dow === 6)) return { skipped: "fim de semana" };
  if (hour < c.start_hour || hour >= c.end_hour) return { skipped: "fora do horário" };
  if (c.next_send_at && new Date(c.next_send_at) > new Date()) return { skipped: "aguardando intervalo" };

  const { count } = await admin.from("prospects").select("id", { count: "exact", head: true })
    .eq("campaign_id", c.id).gte("sent_at", spDayStartUtc());
  if ((count ?? 0) >= c.daily_limit) return { skipped: "limite do dia" };

  // Marca o próximo horário antes de enviar: se outra rodada chegar no meio, não duplica
  const gap = c.min_gap_min + Math.random() * Math.max(0, c.max_gap_min - c.min_gap_min);
  await admin.from("prospect_campaigns").update({ next_send_at: new Date(Date.now() + gap * 60_000).toISOString() }).eq("id", c.id);

  // Até 5 tentativas na rodada (pula quem não tem WhatsApp ou já é contato)
  const { data: queue } = await admin.from("prospects").select("*").eq("campaign_id", c.id).eq("status", "novo").order("created_at").limit(5);
  if (!queue?.length) return { skipped: "fila vazia" };
  for (const p of queue as Prospect[]) {
    const known = await alreadyKnown(admin, p.phone);
    if (known) { await admin.from("prospects").update({ status: "descartado", error: known }).eq("id", p.id); continue; }

    const { results } = await wa("/check", { session: c.session_id || undefined, phones: [p.phone] });
    const waNumber = results?.[p.phone];
    if (!waNumber) { await admin.from("prospects").update({ status: "sem_whatsapp" }).eq("id", p.id); continue; }

    try {
      // Empresa que veio da prospecção manual com mensagem pronta: envia a mensagem dela
      const message = p.message?.trim() || await writeMessage(c, p);
      const sent = await wa("/send", { to: waNumber, message, session: c.session_id || undefined });
      await admin.from("prospects").update({ status: "enviado", message, sent_at: new Date().toISOString(), error: "" }).eq("id", p.id);
      const conv = await upsertConversation(admin, sent.session || c.session_id || "default", normalizePhone(waNumber) ?? p.phone, p.name);
      if (conv) await recordMessage(admin, conv, { direction: "out", content: message, wa_message_id: sent.messageId ?? null });
      return { sent: p.name };
    } catch (e) {
      await admin.from("prospects").update({ status: "erro", error: String((e as Error).message).slice(0, 300) }).eq("id", p.id);
      return { error: (e as Error).message };
    }
  }
  return { skipped: "nenhum com WhatsApp nesta rodada" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "run";

    if (action === "run") {
      const { data: campaigns } = await admin.from("prospect_campaigns").select("*").eq("active", true);
      const results = [];
      for (const c of (campaigns ?? []) as Campaign[]) results.push({ campaign: c.name, ...(await runCampaign(admin, c)) });
      return json({ ran: results });
    }

    // Busca e exemplo: só para quem está logado na plataforma
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(token);
    if (!user?.user) return json({ error: "Faça login na plataforma" }, 401);

    const { data: campaign } = await admin.from("prospect_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
    const c = { ...(campaign ?? {}), ...(body.draft ?? {}) } as Campaign;

    if (action === "sample") {
      const { data: first } = c.id
        ? await admin.from("prospects").select("*").eq("campaign_id", c.id).eq("status", "novo").order("created_at").limit(1).maybeSingle()
        : { data: null };
      const sample = first ?? { name: `${c.niche || "Empresa"} Exemplo`, category: c.niche, address: c.city, rating: 4.7, reviews: 85, website: "" };
      return json({ prospect: sample.name, message: await writeMessage(c, sample) });
    }

    if (action === "search") {
      if (!campaign) return json({ error: "Salve a campanha antes de buscar" }, 400);
      const places = await searchPlaces(`${c.niche} em ${c.city}`);
      let added = 0, noPhone = 0, closed = 0, repeated = 0;
      for (const pl of places) {
        if (pl.businessStatus && pl.businessStatus !== "OPERATIONAL") { closed++; continue; }
        const phone = normalizePhone(pl.internationalPhoneNumber || pl.nationalPhoneNumber);
        if (!phone) { noPhone++; continue; }
        const { error } = await admin.from("prospects").insert({
          campaign_id: c.id, place_id: pl.id, name: pl.displayName?.text ?? "Empresa", phone,
          address: pl.formattedAddress ?? "", category: pl.primaryTypeDisplayName?.text ?? c.niche,
          rating: pl.rating ?? null, reviews: pl.userRatingCount ?? null, website: pl.websiteUri ?? "", maps_url: pl.googleMapsUri ?? "",
        });
        if (error) repeated++; else added++;
      }
      await admin.from("prospect_campaigns").update({ last_search_at: new Date().toISOString() }).eq("id", c.id);
      return json({ found: places.length, added, no_phone: noPhone, closed, repeated });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("prospecting error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
