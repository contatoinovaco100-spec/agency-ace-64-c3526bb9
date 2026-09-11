-- Add contract billing types and extended period support to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'mensal';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS total_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT '';
