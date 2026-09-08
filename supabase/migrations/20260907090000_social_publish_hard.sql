-- Suporte a vídeos longos (até o limite da Meta) publicando em duas fases:
-- 1) social-publish cria/submete o container e persiste o id aqui;
-- 2) process-scheduled-publish (cron) finaliza no fundo o que ainda estiver
--    IN_PROGRESS, sem depender do teto de tempo de uma única Edge Function.
ALTER TABLE public.publish_targets
  ADD COLUMN IF NOT EXISTS remote_container_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- Filas de finalização de container (cron) consultam por status + container.
CREATE INDEX IF NOT EXISTS idx_publish_targets_resumable
  ON public.publish_targets (status, remote_container_id)
  WHERE remote_container_id <> '';

-- Em comum com o novo fluxo, não esquece de expor as novas colunas no realtime.
ALTER TABLE public.publish_targets REPLICA IDENTITY FULL;