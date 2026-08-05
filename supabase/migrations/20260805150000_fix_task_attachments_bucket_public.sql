-- ============================================================
-- Fix: bucket task-attachments voltou a ser público
--
-- Contexto: uploads gravam file_url via getPublicUrl (URL pública),
-- mas a migration 20260423191645 tornou o bucket privado. Isso fez
-- todas as artes históricas retornarem 403 (imagem nunca carrega).
-- Com o bucket público, URLs públicas antigas voltam a funcionar e
-- createSignedUrls passa a funcionar para visitantes anônimos
-- (página pública /conteudo/:id e /artes).
-- ============================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'task-attachments';

-- Permite SELECT anônimo/autenticado nos objetos (cobre createSignedUrls
-- e leitura direta via /public/).
CREATE POLICY "Public read task-attachments"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'task-attachments');
