DROP POLICY IF EXISTS "Admin atualiza perfis" ON public.profiles;
CREATE POLICY "Admin atualiza perfis" ON public.profiles FOR UPDATE TO authenticated
 USING (public.has_role(auth.uid(), 'admin'::app_role))
 WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));