import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Public-friendly: allow anonymous calls (needed for public tools like
    // /diagnostico-anuncios). If a user JWT is present we still validate it,
    // but its absence is NOT an error.
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      // Best-effort validation; ignore failures so anon/publishable keys still work.
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );
        await supabase.auth.getUser(token);
      } catch (_) {
        // ignore — we don't gate the function on auth anymore
      }
    }

    const { systemPrompt, userMessage, model = "google/gemini-2.5-flash", imageBase64, imageMimeType, images } = await req.json();

    if (!userMessage || typeof userMessage !== 'string') {
      return new Response(JSON.stringify({ error: "userMessage é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada.");
    }

    // Build user content (supports optional image for vision)
    const userContent: unknown = imageBase64 && imageMimeType
      ? [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
        ]
      : userMessage;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt || "Você é um assistente útil. Responda sempre em JSON válido." },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway Error:", response.status, errorText);
      throw new Error("Erro de comunicação com o AI Gateway");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("A resposta da IA veio vazia.");
    }

    let parsedContent: unknown;
    try {
      const cleaned = String(content).replace(/```json/g, '').replace(/```/g, '').trim();
      parsedContent = JSON.parse(cleaned);
    } catch {
      parsedContent = content;
    }

    return new Response(JSON.stringify({ result: parsedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Edge function error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
