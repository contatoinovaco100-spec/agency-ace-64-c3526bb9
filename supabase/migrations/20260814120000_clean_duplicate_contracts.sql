-- ============================================================
-- Migration: Limpar contratos duplicados
-- Identifica duplicatas por (title + client_company + client_name)
-- Mantém o registro com mais campos preenchidos (informações completas)
-- ============================================================

-- 1. Criar tabela temporária com IDs dos contratos a MANTER
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        lower(trim(title)),
        lower(trim(client_company)),
        lower(trim(client_name))
      ORDER BY
        -- Prioriza: mais campos preenchidos, depois data mais recente
        (
          CASE WHEN title IS NOT NULL AND title != '' THEN 1 ELSE 0 END +
          CASE WHEN client_company IS NOT NULL AND client_company != '' THEN 1 ELSE 0 END +
          CASE WHEN client_name IS NOT NULL AND client_name != '' THEN 1 ELSE 0 END +
          CASE WHEN client_cpf_cnpj IS NOT NULL AND client_cpf_cnpj != '' THEN 1 ELSE 0 END +
          CASE WHEN client_email IS NOT NULL AND client_email != '' THEN 1 ELSE 0 END +
          CASE WHEN client_address IS NOT NULL AND client_address != '' THEN 1 ELSE 0 END +
          CASE WHEN contractor_name IS NOT NULL AND contractor_name != '' THEN 1 ELSE 0 END +
          CASE WHEN contractor_cpf_cnpj IS NOT NULL AND contractor_cpf_cnpj != '' THEN 1 ELSE 0 END +
          CASE WHEN contractor_address IS NOT NULL AND contractor_address != '' THEN 1 ELSE 0 END +
          CASE WHEN services IS NOT NULL AND services != '' THEN 1 ELSE 0 END +
          CASE WHEN scope_description IS NOT NULL AND scope_description != '' THEN 1 ELSE 0 END +
          CASE WHEN monthly_value > 0 THEN 1 ELSE 0 END +
          CASE WHEN plan_name IS NOT NULL AND plan_name != '' THEN 1 ELSE 0 END +
          CASE WHEN additional_clauses IS NOT NULL AND additional_clauses != '' THEN 1 ELSE 0 END +
          CASE WHEN deliverables IS NOT NULL AND deliverables != '[]'::jsonb THEN 1 ELSE 0 END +
          CASE WHEN affiliate_token IS NOT NULL AND affiliate_token != '' THEN 1 ELSE 0 END +
          CASE WHEN status = 'assinado' THEN 2 ELSE 0 END
        ) AS score,
        created_at DESC
  FROM public.contracts
),
to_keep AS (
  SELECT id FROM ranked WHERE rank = 1
),
to_delete AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rank > 1
)

-- 2. Deletar assinaturas dos contratos duplicados primeiro (FK)
DELETE FROM public.contract_signatures
WHERE contract_id IN (SELECT id FROM to_delete);

-- 3. Deletar os contratos duplicados
DELETE FROM public.contracts
WHERE id IN (SELECT id FROM to_delete);

-- Log: quantos foram removidos
DO $$
DECLARE
  v_total INTEGER;
  v_kept INTEGER;
  v_deleted INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.contracts;
  SELECT COUNT(*) INTO v_kept FROM (
    SELECT DISTINCT ON (
      lower(trim(title)),
      lower(trim(client_company)),
      lower(trim(client_name))
    ) id
    FROM public.contracts
    ORDER BY
      lower(trim(title)),
      lower(trim(client_company)),
      lower(trim(client_name)),
      created_at DESC
  ) sub;
  v_deleted := v_total - v_kept;
  RAISE NOTICE 'Contratos limpos: % duplicados removidos, % contratos únicos mantidos de % total', v_deleted, v_kept, v_total;
END $$;
