-- Assistente do WhatsApp: só responde quando a mensagem (ou o áudio) começa com a palavra-gatilho. Vazio = responde tudo no grupo.
ALTER TABLE public.wa_assistant_settings ADD COLUMN IF NOT EXISTS trigger_word TEXT NOT NULL DEFAULT 'inova';
