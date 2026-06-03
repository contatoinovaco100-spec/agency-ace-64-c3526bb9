-- =========================================================
-- 1. CONTRACTS: drop public direct access; expose via RPCs
-- =========================================================
DROP POLICY IF EXISTS "Public can read sent contracts" ON public.contracts;
DROP POLICY IF EXISTS "Public can update contract status on sign" ON public.contracts;

CREATE OR REPLACE FUNCTION public.get_public_contract(_id uuid)
RETURNS public.contracts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.contracts
  WHERE id = _id AND status IN ('enviado','assinado')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_contract_signed(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET status = 'assinado'
  WHERE id = _id AND status = 'enviado';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_contract_signed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_contract_signed(uuid) TO anon, authenticated;

-- =========================================================
-- 2. CONTRACT_SIGNATURES
-- =========================================================
DROP POLICY IF EXISTS "Public can view own signatures" ON public.contract_signatures;

CREATE OR REPLACE FUNCTION public.get_contract_signature_minimal(_contract_id uuid)
RETURNS TABLE(signer_name text, signed_at timestamptz, signature_hash text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT signer_name, signed_at, signature_hash
  FROM public.contract_signatures
  WHERE contract_id = _contract_id AND accepted = true
  ORDER BY signed_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_contract_signature_minimal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_signature_minimal(uuid) TO anon, authenticated;

-- =========================================================
-- 3. INVOICES
-- =========================================================
DROP POLICY IF EXISTS "Public read invoices" ON public.invoices;

CREATE OR REPLACE FUNCTION public.get_public_invoice(_id uuid)
RETURNS public.invoices
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.invoices WHERE id = _id LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon, authenticated;

-- =========================================================
-- 4. PIX_SETTINGS
-- =========================================================
DROP POLICY IF EXISTS "Public read pix_settings" ON public.pix_settings;

CREATE OR REPLACE FUNCTION public.get_public_pix_settings()
RETURNS public.pix_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.pix_settings LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_pix_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pix_settings() TO anon, authenticated;

-- =========================================================
-- 5. TASKS
-- =========================================================
DROP POLICY IF EXISTS "Public can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can update task status from page" ON public.tasks;

CREATE OR REPLACE FUNCTION public.get_public_client_tasks(_anchor uuid)
RETURNS SETOF public.tasks
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM public.tasks WHERE id = _anchor LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    RETURN QUERY
      SELECT * FROM public.tasks
      WHERE client_id = v_client_id
      ORDER BY due_date NULLS LAST;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.clients WHERE id = _anchor) THEN
    RETURN QUERY
      SELECT * FROM public.tasks
      WHERE client_id = _anchor
      ORDER BY due_date NULLS LAST;
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.tasks WHERE id = _anchor;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_client_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_client_tasks(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_public_task_status(_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('Postado','Programado') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.tasks SET status = _status WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_public_task_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_public_task_status(uuid, text) TO anon, authenticated;

-- =========================================================
-- 6. TASK_COMMENTS: require authenticated
-- =========================================================
DROP POLICY IF EXISTS "Public can insert task_comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can view task_comments" ON public.task_comments;

-- =========================================================
-- 7. ADS_AUDITS & DIAGNOSTICS
-- =========================================================
DROP POLICY IF EXISTS "Public can view ads audits by slug" ON public.ads_audits;
CREATE POLICY "Public can view ads audits by slug"
  ON public.ads_audits FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL AND length(slug) > 0);

DROP POLICY IF EXISTS "Public can view diagnostics by slug" ON public.diagnostics;
CREATE POLICY "Public can view diagnostics by slug"
  ON public.diagnostics FOR SELECT
  TO anon
  USING (slug IS NOT NULL AND length(slug) > 0);

-- =========================================================
-- 8. STORAGE: restrict task-attachments to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Allow all reads from task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes from task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow all inserts to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete task-attachments" ON storage.objects;

CREATE POLICY "Authenticated read task-attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated insert task-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated update task-attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated delete task-attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-attachments');

-- =========================================================
-- 9. SECURITY DEFINER funcs: revoke EXECUTE
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_page_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.renew_recurring_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_recurring_invoices() TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_affiliate_commissions(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_linktree_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_rede_posts_daily_limit() FROM PUBLIC, anon, authenticated;