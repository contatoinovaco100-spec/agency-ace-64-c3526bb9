-- Allow multiple account managers per client: account_manager TEXT -> TEXT[]
ALTER TABLE public.clients ALTER COLUMN account_manager DROP DEFAULT;
ALTER TABLE public.clients
  ALTER COLUMN account_manager TYPE text[]
  USING CASE
    WHEN account_manager IS NULL OR account_manager = '' THEN ARRAY[]::text[]
    ELSE ARRAY[account_manager]::text[]
  END;
ALTER TABLE public.clients ALTER COLUMN account_manager SET DEFAULT ARRAY[]::text[];
