-- Restore EXECUTE on RLS helper functions so policies work for authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_page_access(uuid, text) TO authenticated, anon;