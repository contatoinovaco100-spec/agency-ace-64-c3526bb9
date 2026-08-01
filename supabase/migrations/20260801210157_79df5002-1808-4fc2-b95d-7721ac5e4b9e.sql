CREATE POLICY "admins manage instagram media" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'instagram-media' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'instagram-media' AND public.has_role(auth.uid(), 'admin'::app_role));