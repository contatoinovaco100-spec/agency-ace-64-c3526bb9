
CREATE OR REPLACE FUNCTION public.auto_create_instagram_arte_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_client_id uuid;
  v_client_name text;
  v_title text;
  v_titles text[] := ARRAY['Destaques','Fixado 1','Fixado 2','Fixado 3'];
  v_desc text;
  v_context text;
BEGIN
  IF NEW.accepted IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_client_id := v_contract.client_id;
  IF v_client_id IS NULL AND COALESCE(TRIM(v_contract.client_name), '') <> '' THEN
    SELECT id INTO v_client_id FROM public.clients
      WHERE company_name ILIKE v_contract.client_name LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE client_id = v_client_id
      AND task_type = 'Arte'
      AND title = ANY(v_titles)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT company_name INTO v_client_name FROM public.clients WHERE id = v_client_id;
  v_client_name := COALESCE(v_client_name, 'o cliente');

  FOREACH v_title IN ARRAY v_titles LOOP
    v_context := CASE
      WHEN v_title = 'Destaques' THEN
        'Contexto: Capas dos Destaques do Instagram de ' || v_client_name || ' (identidade visual consistente entre todas as capas).'
      ELSE
        'Contexto: Post fixado no topo do feed de ' || v_client_name || ' — deve comunicar a proposta de valor em 3 segundos.'
    END;

    v_desc := v_context || E'\n\n' ||
      '--- MODELO DE TEXTO DA ARTE ---' || E'\n\n' ||
      'H1 (Headline principal):' || E'\n' ||
      CASE
        WHEN v_title = 'Destaques' THEN '[Ex: "SERVIÇOS", "SOBRE NÓS", "DEPOIMENTOS", "CONTATO"]'
        WHEN v_title = 'Fixado 1' THEN '[Ex: "Você conhece nossa história?"]'
        WHEN v_title = 'Fixado 2' THEN '[Ex: "3 motivos para escolher a ' || v_client_name || '"]'
        ELSE '[Ex: "Fale agora com nossa equipe"]'
      END || E'\n\n' ||
      'H2 (Texto de apoio / corpo da arte):' || E'\n' ||
      CASE
        WHEN v_title = 'Destaques' THEN '[Ícone + palavra curta que represente a categoria do destaque]'
        WHEN v_title = 'Fixado 1' THEN '[Ex: "Conheça quem somos, no que acreditamos e como podemos transformar seu negócio."]'
        WHEN v_title = 'Fixado 2' THEN '[Ex: "Atendimento personalizado, resultados comprovados e time especialista à sua disposição."]'
        ELSE '[Ex: "Atendimento rápido pelo WhatsApp, sem enrolação."]'
      END || E'\n\n' ||
      'CTA (Chamada para ação):' || E'\n' ||
      CASE
        WHEN v_title = 'Destaques' THEN '[Não se aplica — apenas identificação visual]'
        WHEN v_title = 'Fixado 1' THEN '[Ex: "Arraste →" ou "Saiba mais no link da bio"]'
        WHEN v_title = 'Fixado 2' THEN '[Ex: "Clique no link da bio e agende sua conversa"]'
        ELSE '[Ex: "Clique aqui e chame no WhatsApp 👉"]'
      END || E'\n\n' ||
      '⚠️ Substitua os textos entre colchetes pelo copy definitivo aprovado pelo estrategista.';

    INSERT INTO public.tasks (
      client_id, title, description, priority, status, task_type, platform, observations
    ) VALUES (
      v_client_id, v_title, v_desc, 'Média', 'A fazer', 'Arte', 'Instagram',
      'Card criado automaticamente ao assinar contrato. Texto-modelo (H1/H2/CTA) pronto para edição.'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_create_instagram_arte_tasks() FROM PUBLIC, anon, authenticated;
