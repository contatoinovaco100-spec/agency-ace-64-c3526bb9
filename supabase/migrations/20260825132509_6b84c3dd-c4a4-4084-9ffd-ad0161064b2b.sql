ALTER TABLE public.video_schedule ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'video';
ALTER TABLE public.video_schedule DROP CONSTRAINT IF EXISTS video_schedule_board_check;
ALTER TABLE public.video_schedule ADD CONSTRAINT video_schedule_board_check CHECK (board IN ('video','arte'));
CREATE INDEX IF NOT EXISTS idx_video_schedule_week_board ON public.video_schedule (week_start, board);

DROP POLICY IF EXISTS "Authenticated can insert schedule" ON public.video_schedule;
DROP POLICY IF EXISTS "Authenticated can update schedule" ON public.video_schedule;
DROP POLICY IF EXISTS "Authenticated can delete schedule" ON public.video_schedule;

CREATE POLICY "Admins can insert schedule" ON public.video_schedule FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update schedule" ON public.video_schedule FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete schedule" ON public.video_schedule FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));