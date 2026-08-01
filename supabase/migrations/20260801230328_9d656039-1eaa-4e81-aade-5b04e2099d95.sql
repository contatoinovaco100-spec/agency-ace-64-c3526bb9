ALTER TABLE public.social_accounts REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='social_accounts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.social_accounts';
  END IF;
END $$;