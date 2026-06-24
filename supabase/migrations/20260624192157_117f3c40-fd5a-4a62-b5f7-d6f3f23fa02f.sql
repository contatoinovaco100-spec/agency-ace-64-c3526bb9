
-- 1) commercial_members
CREATE TABLE public.commercial_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('SDR','Closer','Gestor')),
  active boolean NOT NULL DEFAULT true,
  monthly_goal_calls int NOT NULL DEFAULT 0,
  monthly_goal_revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_members TO authenticated;
GRANT ALL ON public.commercial_members TO service_role;
ALTER TABLE public.commercial_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read commercial_members" ON public.commercial_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage commercial_members" ON public.commercial_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) commercial_calls
CREATE TABLE public.commercial_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.commercial_members(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('agendada','fechada')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_name text,
  deal_value numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','crm')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_calls TO authenticated;
GRANT ALL ON public.commercial_calls TO service_role;
ALTER TABLE public.commercial_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read commercial_calls" ON public.commercial_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert commercial_calls" ON public.commercial_calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin update commercial_calls" ON public.commercial_calls FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete commercial_calls" ON public.commercial_calls FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_commercial_calls_member ON public.commercial_calls(member_id, occurred_at DESC);
CREATE INDEX idx_commercial_calls_type ON public.commercial_calls(type, occurred_at DESC);

-- 3) commission_plans
CREATE TABLE public.commission_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE CHECK (role IN ('SDR','Closer','Gestor')),
  fixed_per_event numeric NOT NULL DEFAULT 0,
  percent_on_value numeric NOT NULL DEFAULT 0,
  goal_type text NOT NULL DEFAULT 'calls' CHECK (goal_type IN ('calls','revenue')),
  goal_target numeric NOT NULL DEFAULT 0,
  bonus_percent numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_plans TO authenticated;
GRANT ALL ON public.commission_plans TO service_role;
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read commission_plans" ON public.commission_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage commission_plans" ON public.commission_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.commission_plans (role) VALUES ('SDR'), ('Closer'), ('Gestor');

-- updated_at triggers
CREATE TRIGGER trg_commercial_members_updated BEFORE UPDATE ON public.commercial_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commission_plans_updated BEFORE UPDATE ON public.commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Automação CRM: trigger em leads
CREATE OR REPLACE FUNCTION public.sync_commercial_call_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_role text;
  v_type text;
BEGIN
  IF NEW.stage = OLD.stage THEN
    RETURN NEW;
  END IF;

  IF NEW.stage = 'Reunião agendada' THEN
    v_role := 'SDR'; v_type := 'agendada';
  ELSIF NEW.stage = 'Cliente fechado' THEN
    v_role := 'Closer'; v_type := 'fechada';
  ELSE
    RETURN NEW;
  END IF;

  SELECT id INTO v_member_id
  FROM public.commercial_members
  WHERE active = true AND role = v_role AND lower(name) = lower(COALESCE(NEW.assignee,''))
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- evita duplicar mesmo lead+tipo
  IF EXISTS (SELECT 1 FROM public.commercial_calls WHERE lead_id = NEW.id AND type = v_type) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_calls (member_id, type, lead_id, client_name, deal_value, source)
  VALUES (v_member_id, v_type, NEW.id, COALESCE(NEW.company, NEW.name),
          COALESCE(NEW.estimated_value, 0), 'crm');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_commercial_call_from_lead
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_commercial_call_from_lead();
