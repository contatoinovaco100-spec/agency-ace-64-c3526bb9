CREATE POLICY "Public can submit referrals"
ON public.referrals
FOR INSERT
TO anon
WITH CHECK (
  status = 'enviada'
  AND EXISTS (SELECT 1 FROM public.referral_clients rc WHERE rc.id = referrals.client_id)
);