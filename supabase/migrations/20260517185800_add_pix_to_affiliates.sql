-- Add pix_key column to affiliates
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS pix_key TEXT NOT NULL DEFAULT '';

-- Update the RPC to accept pix_key
CREATE OR REPLACE FUNCTION public.register_affiliate_safe(
  p_user_id UUID, p_full_name TEXT, p_cpf_cnpj TEXT, p_whatsapp TEXT, p_email TEXT, p_instagram TEXT, p_city_state TEXT, p_how_found TEXT, p_sales_experience BOOLEAN, p_pix_key TEXT DEFAULT ''
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.affiliates(user_id, full_name, cpf_cnpj, whatsapp, email, instagram, city_state, how_found, sales_experience, status, pix_key)
  VALUES (p_user_id, p_full_name, p_cpf_cnpj, p_whatsapp, p_email, p_instagram, p_city_state, p_how_found, p_sales_experience, 'em_analise', p_pix_key);
END;
$$;
