-- Foto de perfil das conversas do CRM: uma cópia fica no bucket público wa-avatars (o link do WhatsApp expira)
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS contact_avatar TEXT,
  ADD COLUMN IF NOT EXISTS avatar_checked_at TIMESTAMPTZ;
-- O bucket publico wa-avatars e criado pelas ferramentas de storage da plataforma.
