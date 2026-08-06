ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
