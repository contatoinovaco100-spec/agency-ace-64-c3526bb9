// Testa a conexão com o WhatsApp Cloud API da Meta
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('META_WA_TOKEN');
    const phoneId = Deno.env.get('META_WA_PHONE_ID');
    const businessId = Deno.env.get('META_WA_BUSINESS_ID');

    if (!token || !phoneId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Token ou Phone Number ID não configurados',
          missing: { token: !token, phoneId: !phoneId, businessId: !businessId },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Chama a Meta API pra validar o phone number ID + token
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data?.error?.message || 'Erro ao validar credenciais',
          details: data?.error,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        phone_number: data.display_phone_number,
        verified_name: data.verified_name,
        quality_rating: data.quality_rating,
        business_id_configured: !!businessId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
