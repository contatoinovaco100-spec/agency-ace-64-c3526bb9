DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contracts','service_contracts','contract_signatures','invoices','pix_settings','tasks']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END$$;

-- contract_signatures precisa de INSERT por anon (assinatura pública)
GRANT INSERT ON public.contract_signatures TO anon;