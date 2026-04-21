-- Tabela de mensagens do chat interno
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'geral',
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel_created ON public.chat_messages(channel, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler e enviar mensagens
CREATE POLICY "Authenticated users read chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users delete own chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;