
-- Add client_id column to referral_clients to link with clients table
ALTER TABLE public.referral_clients
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX idx_referral_clients_client_id ON public.referral_clients(client_id);

-- Add unique constraint so one client can have at most one referral profile
CREATE UNIQUE INDEX idx_referral_clients_client_id_unique ON public.referral_clients(client_id)
WHERE client_id IS NOT NULL;
