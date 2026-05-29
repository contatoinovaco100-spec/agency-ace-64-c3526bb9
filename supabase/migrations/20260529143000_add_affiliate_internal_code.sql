-- Adiciona código interno único para afiliados (ex: AF-001, AF-002)
ALTER TABLE affiliates ADD COLUMN codigo_interno VARCHAR UNIQUE;

-- Faz backfill com códigos sequenciais para afiliados existentes
DO $$
DECLARE
  aff RECORD;
  seq INT := 1;
BEGIN
  FOR aff IN SELECT id FROM affiliates ORDER BY created_at LOOP
    UPDATE affiliates SET codigo_interno = 'AF-' || LPAD(seq::TEXT, 3, '0') WHERE id = aff.id;
    seq := seq + 1;
  END LOOP;
END $$;
