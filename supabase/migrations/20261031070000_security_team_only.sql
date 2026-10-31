-- Varredura de segurança (31/10/2026)
-- 1) Dados internos só para a equipe. Antes, qualquer conta logada (inclusive quem se cadastra
--    sozinho na tela de login, afiliados, clientes do portal e empresas da Rede) lia e alterava
--    clientes, leads, tarefas, contratos etc.
-- 2) Permissões (user_roles, user_page_access) só o admin altera.
-- 3) Relatórios públicos (diagnóstico, auditoria de anúncios e de Instagram) abrem só pelo link,
--    sem dar para listar todos.
-- 4) Ajustes nas páginas públicas: quiz, linktree e assinatura de contrato.

-- ===== 1. Quem é da equipe =====
-- Admin ou quem tem alguma página liberada em Funcionários (o admin libera; ninguém se dá acesso sozinho)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.user_page_access WHERE user_id = _user_id)
  )
$$;
REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;

-- ===== 2. Permissões: só admin altera; cada um lê as próprias (equipe lê todas) =====
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('user_roles', 'user_page_access') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê os próprios papéis ou equipe" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(auth.uid()));
CREATE POLICY "Admin gerencia papéis" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Lê as próprias páginas ou admin" ON public.user_page_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin gerencia páginas" ON public.user_page_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Perfil: ninguém se promove editando o próprio perfil (username/is_active marcam funcionário)
CREATE OR REPLACE FUNCTION public.protect_profile_team_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.username := OLD.username;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active') THEN
    DROP TRIGGER IF EXISTS trg_protect_profile_team_fields ON public.profiles;
    CREATE TRIGGER trg_protect_profile_team_fields BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profile_team_fields();
  END IF;
END $$;

-- ===== 3. Dados internos: "qualquer logado" vira "só a equipe" =====
-- Converte toda regra aberta (USING true / qualquer logado) das tabelas internas.
-- Ficam de fora as tabelas que afiliados, empresas da Rede e páginas públicas usam
-- (essas já têm regras próprias por dono).
DO $$
DECLARE
  p record;
  open_expr text := '^\(?(true|\(?auth\.uid\(\) IS NOT NULL\)?|\(?auth\.role\(\) = ''authenticated''::text\)?)\)?$';
  team text := 'public.is_team_member(auth.uid())';
BEGIN
  FOR p IN
    SELECT policyname, tablename, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles @> ARRAY['authenticated']::name[] OR roles @> ARRAY['public']::name[])
      AND (coalesce(qual, '') ~ open_expr OR coalesce(with_check, '') ~ open_expr)
      AND tablename NOT IN ('profiles', 'user_roles', 'user_page_access', 'app_errors',
                            'portfolio_projects', 'vitrine_settings', 'contract_signatures')
      AND tablename NOT LIKE 'rede\_%'
      AND tablename NOT LIKE 'affiliate%'
      AND tablename NOT LIKE 'referral%'
      AND tablename NOT LIKE 'quiz%'
      AND tablename NOT LIKE 'linktree%'
  LOOP
    IF p.cmd = 'SELECT' OR p.cmd = 'DELETE' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s)', p.policyname, p.tablename, team);
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated WITH CHECK (%s)', p.policyname, p.tablename, team);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s) WITH CHECK (%s)', p.policyname, p.tablename, team, team);
    END IF;
    RAISE NOTICE 'Só equipe: %.% (%)', p.tablename, p.policyname, p.cmd;
  END LOOP;
END $$;

-- ===== 4. Relatórios públicos: só pelo link (slug), sem listar todos =====
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('diagnostics', 'ads_audits', 'social_audits')
             AND roles @> ARRAY['anon']::name[] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
REVOKE ALL ON public.diagnostics, public.ads_audits, public.social_audits FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_report(_kind text, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF _slug IS NULL OR length(_slug) < 3 THEN RETURN NULL; END IF;
  IF _kind = 'diagnostic' THEN
    SELECT to_jsonb(d) - 'user_id' INTO r FROM public.diagnostics d WHERE d.slug = _slug LIMIT 1;
  ELSIF _kind = 'ads' THEN
    SELECT to_jsonb(a) - 'user_id' INTO r FROM public.ads_audits a WHERE a.slug = _slug LIMIT 1;
  ELSIF _kind = 'social' THEN
    SELECT to_jsonb(s) - 'user_id' INTO r FROM public.social_audits s WHERE s.slug = _slug LIMIT 1;
  END IF;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_report(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_report(text, text) TO anon, authenticated;

-- ===== 5. Páginas públicas =====
-- Quiz: visitante vê só o necessário da empresa (sem email e anotações)
REVOKE SELECT ON public.quiz_clients FROM anon;
GRANT SELECT (id, name, slug, company, status) ON public.quiz_clients TO anon;
-- Respostas do quiz passam pelas funções start/submit_public_quiz_*; visitante não escreve direto
REVOKE INSERT, UPDATE ON public.quiz_responses FROM anon;
REVOKE INSERT ON public.quiz_answers FROM anon;

-- Linktree: visitante só soma clique, não troca link
REVOKE UPDATE ON public.linktree_links FROM anon;
GRANT UPDATE (clicks) ON public.linktree_links TO anon;

-- Contrato só vira "assinado" se tiver assinatura registrada
CREATE OR REPLACE FUNCTION public.mark_contract_signed(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET status = 'assinado'
  WHERE id = _id AND status = 'enviado'
    AND EXISTS (SELECT 1 FROM public.contract_signatures s WHERE s.contract_id = _id);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_contract_signed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_contract_signed(uuid) TO anon, authenticated;

-- Função antiga sem uso que mudava status de qualquer tarefa sem login
REVOKE ALL ON FUNCTION public.update_public_task_status(uuid, text) FROM PUBLIC, anon;
