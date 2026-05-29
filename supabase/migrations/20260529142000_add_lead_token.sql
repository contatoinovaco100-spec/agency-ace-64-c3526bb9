-- Adiciona token único para leads de afiliados
ALTER TABLE affiliate_leads ADD COLUMN token VARCHAR UNIQUE;

-- Adiciona campo para token do afiliado nos contratos principais
ALTER TABLE contracts ADD COLUMN affiliate_token VARCHAR;
