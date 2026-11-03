-- Foto de perfil das conversas do CRM: uma cópia fica no bucket público wa-avatars (o link do WhatsApp expira)
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS contact_avatar TEXT,
  ADD COLUMN IF NOT EXISTS avatar_checked_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-avatars', 'wa-avatars', true)
ON CONFLICT (id) DO NOTHING;
