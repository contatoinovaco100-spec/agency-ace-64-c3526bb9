-- Admin edita o perfil dos funcionários (cargo, WhatsApp, ativo) em Equipe → Funcionários.
-- Antes só existia "cada um edita o próprio perfil": a alteração do admin em outra pessoa era ignorada sem erro.
DROP POLICY IF EXISTS "Admin atualiza perfis" ON public.profiles;
CREATE POLICY "Admin atualiza perfis" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
