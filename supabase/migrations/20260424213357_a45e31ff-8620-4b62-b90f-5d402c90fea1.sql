CREATE POLICY "Public can view clients"
ON public.clients
FOR SELECT
TO anon
USING (true);