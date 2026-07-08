
-- ============================================================
-- Security hardening: RLS, public RPCs, and SECURITY DEFINER surface reduction
-- ============================================================

-- 1) clients: drop public read; auth users still manage via existing policy
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;

-- 2) task_attachments: drop public read
DROP POLICY IF EXISTS "Public can view task_attachments" ON public.task_attachments;

-- 3) task_checklist_items: drop public read
DROP POLICY IF EXISTS "Public can view task_checklist_items" ON public.task_checklist_items;

-- 4) referrals: drop broad public read; replace with token-scoped RPC
DROP POLICY IF EXISTS "Public read referrals" ON public.referrals;

-- 5) service_contracts: drop anon read/write (legacy table, not used by app)
DROP POLICY IF EXISTS "Public can view service contracts for signing" ON public.service_contracts;
DROP POLICY IF EXISTS "Public can update service contracts for signing" ON public.service_contracts;

-- 6) affiliates: drop full-row public read; replace with restricted RPC
DROP POLICY IF EXISTS "Public view approved by slug" ON public.affiliates;

-- ============================================================
-- Public RPCs (SECURITY DEFINER, tightly scoped)
-- ============================================================

-- Minimal client name lookup (used by public content page)
CREATE OR REPLACE FUNCTION public.get_public_client_name(_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_name FROM public.clients WHERE id = _id LIMIT 1
$$;

-- Approved affiliate lookup by slug (only non-sensitive columns)
CREATE OR REPLACE FUNCTION public.get_public_affiliate_by_slug(_slug text)
RETURNS TABLE(id uuid, full_name text, slug text, instagram text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, slug, instagram
  FROM public.affiliates
  WHERE slug = _slug AND status = 'aprovado'
  LIMIT 1
$$;

-- Referrals list scoped by a valid referral_clients token
CREATE OR REPLACE FUNCTION public.get_public_referrals_by_token(_token text)
RETURNS SETOF public.referrals
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id INTO v_client_id
  FROM public.referral_clients
  WHERE token = _token
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.referrals
  WHERE client_id = v_client_id
  ORDER BY created_at DESC;
END;
$$;

-- ============================================================
-- SECURITY DEFINER exposure: revoke PUBLIC EXECUTE and grant narrowly
-- ============================================================

-- Trigger functions: nobody should call these directly
REVOKE ALL ON FUNCTION public.auto_create_client_on_signature() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_commercial_call_from_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_rede_posts_daily_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Internal RLS helpers: only callable from within policies / other functions
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_page_access(uuid, text) FROM PUBLIC, anon, authenticated;

-- Admin-only maintenance functions: authenticated only (internal admin check inside)
REVOKE ALL ON FUNCTION public.generate_monthly_affiliate_commissions(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_affiliate_commissions(date) TO authenticated;

REVOKE ALL ON FUNCTION public.renew_recurring_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_recurring_invoices() TO authenticated;

REVOKE ALL ON FUNCTION public.rename_kanban_stage(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_kanban_stage(text, text, text) TO authenticated;

-- Public RPCs used by anonymous public pages: keep both anon + authenticated
REVOKE ALL ON FUNCTION public.get_public_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_contract_signature_minimal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_signature_minimal(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_pix_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pix_settings() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_arte_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_arte_tasks() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_client_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_client_tasks(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_public_task_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_public_task_status(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.mark_contract_signed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_contract_signed(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_quiz_counter(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_quiz_counter(uuid, text) TO anon, authenticated;

-- New public RPCs added in this migration
REVOKE ALL ON FUNCTION public.get_public_client_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_client_name(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_affiliate_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_affiliate_by_slug(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_referrals_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_referrals_by_token(text) TO anon, authenticated;
