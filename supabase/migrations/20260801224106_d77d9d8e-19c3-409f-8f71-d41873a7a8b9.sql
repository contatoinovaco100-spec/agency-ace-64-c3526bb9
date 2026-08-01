ALTER TABLE public.portfolio_projects REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;