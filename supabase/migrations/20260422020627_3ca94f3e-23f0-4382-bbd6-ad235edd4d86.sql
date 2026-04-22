-- Tabela de sincronização do servidor WhatsApp Baileys
CREATE TABLE IF NOT EXISTS public.wa_sync_v1 (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED',
  qr_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_sync_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view wa_sync"
  ON public.wa_sync_v1 FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wa_sync"
  ON public.wa_sync_v1 FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Habilitar realtime para o painel ver o QR Code aparecer ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_sync_v1;