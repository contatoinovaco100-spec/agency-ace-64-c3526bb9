ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS token_status text,
  ADD COLUMN IF NOT EXISTS token_error text,
  ADD COLUMN IF NOT EXISTS token_checked_at timestamptz;