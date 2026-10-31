import { teamUserId, forbidden } from "../_shared/team.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Só a equipe da INOVA (conta criada pelo "Cadastrar", afiliado ou cliente não usa)
  if (!(await teamUserId(req))) return forbidden(corsHeaders);

  // Verify auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
  const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');

  if (!INSTANCE_ID || !ZAPI_TOKEN) {
    return new Response(JSON.stringify({ error: 'Z-API credentials not configured' }), { status: 500, headers: corsHeaders });
  }

  const ZAPI_BASE = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${ZAPI_TOKEN}`;

  try {
    const { action, ...body } = await req.json();

    if (action === 'get-chats') {
      const response = await fetch(`${ZAPI_BASE}/chats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Z-API get-chats failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-messages') {
      const { phone: chatPhone } = body;
      if (!chatPhone) {
        return new Response(JSON.stringify({ error: 'phone is required' }), { status: 400, headers: corsHeaders });
      }
      const response = await fetch(`${ZAPI_BASE}/get-messages/${chatPhone}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Z-API get-messages failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-text') {
      const { phone: sendPhone, message } = body;
      if (!sendPhone || !message) {
        return new Response(JSON.stringify({ error: 'phone and message are required' }), { status: 400, headers: corsHeaders });
      }
      const response = await fetch(`${ZAPI_BASE}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sendPhone, message }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Z-API send-text failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-status') {
      const response = await fetch(`${ZAPI_BASE}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Z-API status failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Z-API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
