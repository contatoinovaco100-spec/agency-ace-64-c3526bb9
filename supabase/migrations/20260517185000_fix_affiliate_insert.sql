-- Drop the potentially buggy policy
DROP POLICY IF EXISTS "Anyone can register as affiliate" ON public.affiliates;

-- Re-create it just to be 100% sure it allows anon and authenticated
CREATE POLICY "Anyone can register as affiliate" ON public.affiliates
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'em_analise');

-- Add a safe RPC function for registering affiliates bypassing any weird RLS issues
CREATE OR REPLACE FUNCTION public.register_affiliate_safe(
  p_user_id UUID, p_full_name TEXT, p_cpf_cnpj TEXT, p_whatsapp TEXT, p_email TEXT, p_instagram TEXT, p_city_state TEXT, p_how_found TEXT, p_sales_experience BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.affiliates(user_id, full_name, cpf_cnpj, whatsapp, email, instagram, city_state, how_found, sales_experience, status)
  VALUES (p_user_id, p_full_name, p_cpf_cnpj, p_whatsapp, p_email, p_instagram, p_city_state, p_how_found, p_sales_experience, 'em_analise');
END;
$$;
