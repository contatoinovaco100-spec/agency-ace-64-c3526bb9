
CREATE TABLE public.squads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#BFF720',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.squad_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);
CREATE TABLE public.squad_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads TO authenticated;
GRANT ALL ON public.squads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_members TO authenticated;
GRANT ALL ON public.squad_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_clients TO authenticated;
GRANT ALL ON public.squad_clients TO service_role;

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage squads" ON public.squads FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Members view their squads" ON public.squads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squads.id AND sm.user_id = auth.uid()));

CREATE POLICY "Admins manage squad_members" ON public.squad_members FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own squad memberships" ON public.squad_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage squad_clients" ON public.squad_clients FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Squad members view their clients" ON public.squad_clients FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_clients.squad_id AND sm.user_id = auth.uid()));

CREATE TRIGGER update_squads_updated_at BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
