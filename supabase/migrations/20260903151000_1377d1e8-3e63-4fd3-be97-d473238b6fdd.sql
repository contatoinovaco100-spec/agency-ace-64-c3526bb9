-- =========================================================
-- CORREÇÃO: "new row violates row-level security policy for
-- table contract_signatures" ao assinar contrato.
-- A tabela contract_signatures só tinha política de INSERT
-- para o papel anon. Quando o signatário está logado no app
-- (papel authenticated), o INSERT era bloqueado pela RLS.
-- Adicionamos a política de INSERT também para authenticated.
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_signatures'
      AND policyname = 'Authenticated users can sign contracts'
  ) THEN
    CREATE POLICY "Authenticated users can sign contracts"
      ON public.contract_signatures
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
