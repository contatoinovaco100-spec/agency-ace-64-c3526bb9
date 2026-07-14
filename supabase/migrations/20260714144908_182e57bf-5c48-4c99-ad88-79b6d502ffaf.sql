
CREATE TABLE public.video_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  position SMALLINT NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  custom_label TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_schedule_week ON public.video_schedule(week_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_schedule TO authenticated;
GRANT ALL ON public.video_schedule TO service_role;

ALTER TABLE public.video_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view schedule"
ON public.video_schedule FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert schedule"
ON public.video_schedule FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update schedule"
ON public.video_schedule FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete schedule"
ON public.video_schedule FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_video_schedule_updated_at
BEFORE UPDATE ON public.video_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
