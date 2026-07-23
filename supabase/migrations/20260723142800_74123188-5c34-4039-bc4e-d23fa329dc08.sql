-- Secure public quiz response completion with per-response edit tokens
ALTER TABLE public.quiz_responses
  ADD COLUMN IF NOT EXISTS update_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-'::text, '');

DROP POLICY IF EXISTS "public update own quiz_responses" ON public.quiz_responses;

CREATE OR REPLACE FUNCTION public.complete_public_quiz_response(
  _response_id uuid,
  _update_token text,
  _lead_name text DEFAULT '',
  _lead_email text DEFAULT '',
  _lead_phone text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_responses
     SET completed_at = now(),
         lead_name = COALESCE(_lead_name, ''),
         lead_email = COALESCE(_lead_email, ''),
         lead_phone = COALESCE(_lead_phone, '')
   WHERE id = _response_id
     AND update_token = _update_token
     AND completed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid quiz response token';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_public_quiz_response(uuid, text, text, text, text) TO anon, authenticated;

-- Keep public insert possible, but allow returning only the newly generated edit token via explicit selected columns.
DROP POLICY IF EXISTS "public read inserted quiz_responses token" ON public.quiz_responses;
CREATE POLICY "public read inserted quiz_responses token"
ON public.quiz_responses
FOR SELECT
TO anon
USING (completed_at IS NULL AND lead_name = '' AND lead_email = '' AND lead_phone = '');

-- Secure public referral links by hiding referral_clients table from direct public reads.
DROP POLICY IF EXISTS "Public read referral clients" ON public.referral_clients;
REVOKE SELECT ON public.referral_clients FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_referral_client_by_token(_token text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.name
  FROM public.referral_clients rc
  WHERE rc.token = _token
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_referral_client_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_referral(
  _token text,
  _referred_name text,
  _referred_whatsapp text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_referral_id uuid;
BEGIN
  SELECT rc.id INTO v_client_id
  FROM public.referral_clients rc
  WHERE rc.token = _token
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'invalid referral token';
  END IF;

  IF length(trim(COALESCE(_referred_name, ''))) < 2 OR length(trim(COALESCE(_referred_name, ''))) > 120 THEN
    RAISE EXCEPTION 'invalid referred name';
  END IF;

  IF length(trim(COALESCE(_referred_whatsapp, ''))) < 8 OR length(trim(COALESCE(_referred_whatsapp, ''))) > 30 THEN
    RAISE EXCEPTION 'invalid referred whatsapp';
  END IF;

  INSERT INTO public.referrals (client_id, referred_name, referred_whatsapp, status)
  VALUES (v_client_id, trim(_referred_name), trim(_referred_whatsapp), 'enviada')
  RETURNING id INTO v_referral_id;

  RETURN v_referral_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_referral(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_referrals_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can submit referrals" ON public.referrals;
REVOKE INSERT ON public.referrals FROM anon;