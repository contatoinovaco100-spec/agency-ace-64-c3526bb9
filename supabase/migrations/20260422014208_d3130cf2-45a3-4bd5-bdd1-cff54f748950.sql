-- Tabela de conversas do WhatsApp
CREATE TABLE public.wa_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_phone TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL DEFAULT '',
  last_message TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_conversations_phone ON public.wa_conversations(contact_phone);
CREATE INDEX idx_wa_conversations_last_message_at ON public.wa_conversations(last_message_at DESC);

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_conversations"
  ON public.wa_conversations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de mensagens
CREATE TABLE public.wa_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'video', 'document', 'template', 'sticker', 'location')),
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'received')),
  error_message TEXT,
  template_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_conversation ON public.wa_messages(conversation_id, created_at);
CREATE INDEX idx_wa_messages_wa_id ON public.wa_messages(wa_message_id);

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_messages"
  ON public.wa_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de templates aprovados
CREATE TABLE public.wa_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  status TEXT NOT NULL DEFAULT 'PENDING',
  body_text TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_templates"
  ON public.wa_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers de updated_at
CREATE TRIGGER update_wa_conversations_updated_at
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wa_templates_updated_at
  BEFORE UPDATE ON public.wa_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;