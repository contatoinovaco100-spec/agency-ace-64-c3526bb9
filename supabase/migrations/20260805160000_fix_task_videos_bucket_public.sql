-- Torna o bucket task-videos público: URLs públicas antigas voltam a funcionar
-- e visitantes anônimos conseguem re-assinar URLs (createSignedUrl) no /conteudo
UPDATE storage.buckets SET public = true WHERE id = 'task-videos';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read task-videos'
  ) THEN
    CREATE POLICY "Public read task-videos" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'task-videos');
  END IF;
END $$;
