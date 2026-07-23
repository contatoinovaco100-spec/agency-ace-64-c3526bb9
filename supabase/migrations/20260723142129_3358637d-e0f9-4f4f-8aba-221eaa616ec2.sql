-- Restore Data API table privileges for authenticated app users and internal server functions.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Restore public access only for tables that already have anon RLS policies.
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

-- Restore RPC/function execution used by the app and public pages.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Keep future objects reachable if new tables/functions are added by migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;