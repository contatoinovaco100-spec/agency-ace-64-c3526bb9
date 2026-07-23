-- Tighten anonymous Data API privileges after restoring the app.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Public table access: only tables that already have anon RLS policies.
GRANT SELECT ON public.ads_audits TO anon;
GRANT INSERT ON public.affiliate_leads TO anon;
GRANT INSERT ON public.affiliates TO anon;
GRANT INSERT ON public.client_briefings TO anon;
GRANT INSERT ON public.contract_signatures TO anon;
GRANT SELECT ON public.diagnostics TO anon;
GRANT SELECT, UPDATE ON public.linktree_links TO anon;
GRANT SELECT ON public.linktrees TO anon;
GRANT SELECT ON public.portfolio_projects TO anon;
GRANT INSERT ON public.quiz_answers TO anon;
GRANT SELECT ON public.quiz_clients TO anon;
GRANT SELECT ON public.quiz_options TO anon;
GRANT SELECT ON public.quiz_questions TO anon;
GRANT INSERT, UPDATE ON public.quiz_responses TO anon;
GRANT SELECT ON public.quizzes TO anon;
GRANT SELECT ON public.rede_companies TO anon;
GRANT SELECT ON public.rede_post_comments TO anon;
GRANT SELECT ON public.rede_post_likes TO anon;
GRANT SELECT ON public.rede_posts TO anon;
GRANT SELECT ON public.referral_clients TO anon;
GRANT SELECT ON public.referral_tiers TO anon;
GRANT INSERT ON public.referrals TO anon;

-- Public RPC access: only functions called by public pages.
GRANT EXECUTE ON FUNCTION public.get_public_client_name(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_referrals_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_quiz_counter(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_affiliate_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_public_task_status(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_pix_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.mark_contract_signed(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_contract(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_contract_signature_minimal(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_landing_page(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_client_tasks(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_arte_tasks() TO anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'register_affiliate_safe'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.register_affiliate_safe(text, text, text, text, text, text, text) TO anon';
  END IF;
END $$;

-- Keep internal users and server functions restored.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;