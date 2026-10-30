// Ponte entre a plataforma e o servidor WhatsApp (QR Code) da INOVA na Oracle Cloud.
// Só para usuários logados (verify_jwt): a chave do servidor (WA_API_KEY) nunca vai para o navegador.
// Ações: status, groups (grupos do número conectado) e send ({ to, message }).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const serverUrl = Deno.env.get('WA_SERVER_URL');
  const apiKey = Deno.env.get('WA_API_KEY');
  if (!serverUrl || !apiKey) return json({ error: 'Servidor do WhatsApp não configurado (WA_SERVER_URL / WA_API_KEY)' }, 500);

  try {
    const { action, to, message } = await req.json().catch(() => ({}));
    const call = (path: string, init: RequestInit = {}) => fetch(`${serverUrl}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...(init.headers ?? {}) },
    });

    let res: Response;
    if (action === 'status') res = await call('/status');
    else if (action === 'groups') res = await call('/groups');
    else if (action === 'send') res = await call('/send', { method: 'POST', body: JSON.stringify({ to, message }) });
    else return json({ error: 'Ação inválida' }, 400);

    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  } catch (e) {
    return json({ error: `Servidor do WhatsApp fora do ar: ${(e as Error).message}` }, 502);
  }
});
