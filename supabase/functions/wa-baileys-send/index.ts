// Desativada: mandava WhatsApp pelo número da INOVA sem exigir login e não é usada pela plataforma.
// Os envios passam por wa-send (só equipe) e pelas automações.
Deno.serve(() => new Response(JSON.stringify({ error: "Função desativada" }), {
  status: 410, headers: { "Content-Type": "application/json" },
}));
