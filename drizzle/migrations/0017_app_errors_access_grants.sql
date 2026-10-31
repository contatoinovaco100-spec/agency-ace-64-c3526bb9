GRANT INSERT ON public.app_errors TO anon;
GRANT INSERT, SELECT, DELETE ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;