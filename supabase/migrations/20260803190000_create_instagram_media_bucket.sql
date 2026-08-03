-- O bucket nunca foi criado em produção (só existiam as policies em storage.objects).
-- Cria o bucket privado usado pelo /publicar, permitindo vídeos até 500 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('instagram-media', 'instagram-media', false, 524288000)
ON CONFLICT (id) DO NOTHING;
