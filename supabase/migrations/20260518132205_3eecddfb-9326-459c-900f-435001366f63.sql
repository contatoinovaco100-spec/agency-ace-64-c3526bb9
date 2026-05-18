CREATE POLICY "Affiliates view own by email"
ON public.affiliates FOR SELECT
TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')));