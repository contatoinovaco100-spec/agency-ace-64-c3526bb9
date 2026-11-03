CREATE TABLE IF NOT EXISTS public.head_routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period IN ('diario', 'semanal', 'mensal')),
  title TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.head_routine_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.head_routine_items(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  checked_by TEXT NOT NULL DEFAULT '',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, period_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.head_routine_items TO authenticated;
GRANT ALL ON public.head_routine_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.head_routine_checks TO authenticated;
GRANT ALL ON public.head_routine_checks TO service_role;

ALTER TABLE public.head_routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.head_routine_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe usa a rotina do head" ON public.head_routine_items;
CREATE POLICY "Equipe usa a rotina do head" ON public.head_routine_items FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Equipe marca a rotina do head" ON public.head_routine_checks;
CREATE POLICY "Equipe marca a rotina do head" ON public.head_routine_checks FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

INSERT INTO public.head_routine_items (period, title, hint, link, sort)
SELECT * FROM (VALUES
  ('diario',  'Revisar os erros dos posts e cobrar os social medias', 'Painel de erros: mande no WhatsApp de quem tem pendência', '/head', 1),
  ('diario',  'Aprovar internamente o que está em Revisão', 'Nada vai para o cliente sem passar por você', '/tarefas', 2),
  ('diario',  'Distribuir os ajustes pedidos pelos clientes', 'Cada ajuste com responsável e prazo', '/meu-dia', 3),
  ('diario',  'Conferir os posts de hoje e amanhã', 'Legenda, horário e arquivo final prontos', '/planner', 4),
  ('diario',  'Destravar cards parados no kanban', 'Card há dias na mesma etapa: descobrir o que falta', '/tarefas', 5),
  ('semanal', 'Reunião de pauta com os social medias (segunda)', 'Prioridades da semana por cliente', '', 1),
  ('semanal', 'Todo cliente com posts planejados para a próxima semana', 'Veja a lista de clientes abaixo', '/head', 2),
  ('semanal', 'Ler as observações semanais de cada cliente', '', '/observacoes-semanais', 3),
  ('semanal', 'Checar datas comemorativas das próximas 3 semanas', 'Começar a produzir com antecedência', '/planner', 4),
  ('semanal', 'Fechar a semana: feedback para cada social media (sexta)', 'Use a pontuação de erros como base', '/head', 5),
  ('mensal',  'Planejamento do mês seguinte aprovado para cada cliente', '', '/planejamento', 1),
  ('mensal',  'Relatório mensal de resultados enviado aos clientes', '', '/clientes', 2),
  ('mensal',  'Revisar clientes A da curva ABC e clientes em risco', '', '/clientes', 3),
  ('mensal',  'Conversa individual (1:1) com cada social media', 'Feedback, metas e carga de trabalho', '', 4),
  ('mensal',  'Conferir escopo entregue x contratado de cada cliente', '', '/escopos', 5),
  ('mensal',  'Coletar a nota dos clientes', '', '/nota-cliente', 6)
) AS v(period, title, hint, link, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.head_routine_items);