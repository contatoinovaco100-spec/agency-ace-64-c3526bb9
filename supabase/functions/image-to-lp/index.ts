import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um desenvolvedor web expert em replicar landing pages a partir de imagens. Sua tarefa é analisar a imagem de uma landing page e gerar um arquivo HTML completo, responsivo e funcional que replique fielmente o design mostrado.

INSTRUÇÕES OBRIGATÓRIAS:
1. Analise CUIDADOSAMENTE a imagem: cores, tipografia, espaçamentos, layout, hierarquia visual, botões, seções, imagens, ícones, gradientes, bordas, sombras.
2. Gere HTML COMPLETO com CSS embutido (usando <style> no <head>).
3. Use CSS moderno: flexbox, grid, variables CSS para cores.
4. O design DEVE ser 100% responsivo (mobile-first).
5. Inclua Google Fonts quando necessário (identifique a fonte aproximada).
6. Use Font Awesome ou Lucide icons via CDN quando houver ícones.
7. Preserve TODO o conteúdo de texto visível na imagem.
8. Mantenha a hierarquia: headings, parágrafos, botões, cards, etc.
9. Se houver imagens/fotos na imagem, use placeholders comuns (picsum.photos, via.placeholder.com) ou blocks de cor com o mesmo estilo.
10. Se houver logo, crie um placeholder com o nome da empresa.
11. Inclua smooth scroll, hover effects e transições quando aplicável.
12. O HTML deve ser autocontido (um único arquivo .html).
13. Adicione meta viewport para responsividade.

ESTRUTURA ESPERADA DO HTML:
- <!DOCTYPE html> com lang="pt-BR"
- <head> com meta charset, viewport, title, Google Fonts, CSS
- <body> com todas as seções da landing page
- Footer com copyright
- CSS responsivo com media queries

Responda APENAS com o código HTML completo, sem explicações adicionais, sem markdown. O HTML deve começar com <!DOCTYPE html> e terminar com </html>.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        await supabase.auth.getUser(token);
      } catch (_) {
        // ignore
      }
    }

    const { imageBase64, imageMimeType, title } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 é obrigatório." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!title || typeof title !== "string") {
      return new Response(
        JSON.stringify({ error: "title é obrigatório." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada.");
    }

    const mimeType = imageMimeType || "image/png";
    const userMessage = `Analise esta imagem de landing page e gere um HTML completo que replique fielmente o design.\n\nTítulo da página: "${title}"\n\nReplicação fiel: cores, layout, tipografia, espaçamentos, hierarquia, botões, seções, conteúdo de texto, ícones, efeitos visuais. O resultado deve ser um arquivo HTML autocontido e responsivo.`;

    const userContent = [
      { type: "text", text: userMessage },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          max_tokens: 16384,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "Limite de requisições atingido. Tente novamente em instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos de IA esgotados. Adicione créditos no workspace.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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

    // Clean up possible markdown code fences
    let html = content
      .replace(/```html/g, "")
      .replace(/```/g, "")
      .trim();

    // Ensure it starts with doctype
    if (!html.toLowerCase().startsWith("<!doctype")) {
      html = "<!DOCTYPE html>\n" + html;
    }

    return new Response(
      JSON.stringify({
        html,
        ai_notes: {
          applied: true,
          source: "image_analysis",
          model: "google/gemini-2.5-flash",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Edge function error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
