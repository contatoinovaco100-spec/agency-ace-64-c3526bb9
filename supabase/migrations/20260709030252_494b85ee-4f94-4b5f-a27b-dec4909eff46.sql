
CREATE POLICY "Authenticated can upload task videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-videos');

CREATE POLICY "Authenticated can read task videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-videos');

CREATE POLICY "Authenticated can update task videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-videos');

CREATE POLICY "Authenticated can delete task videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-videos');
