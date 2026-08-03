-- O bucket nunca foi criado em produção (só existiam as policies em storage.objects).
-- Cria o bucket privado usado pelo /publicar.
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-media', 'instagram-media', false)
ON CONFLICT (id) DO NOTHING;

-- Aumenta o limite de arquivo para 500 MB (só se a coluna existir na versão).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit'
  ) THEN
    UPDATE storage.buckets SET file_size_limit = 524288000 WHERE id = 'instagram-media';
  END IF;
END $$;
