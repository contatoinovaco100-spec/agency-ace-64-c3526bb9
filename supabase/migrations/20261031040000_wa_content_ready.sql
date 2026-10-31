-- Portal do cliente: aviso no WhatsApp assim que entra conteúdo novo para aprovar.
-- Entra desligada, como as outras: revise o texto e ligue em /automacoes.
INSERT INTO public.wa_automations (name, description, trigger, template, days_of_week, send_time, params, audience)
SELECT 'Conteúdo novo para aprovar', 'Avisa o cliente assim que um conteúdo fica pronto para aprovação', 'content_ready',
  E'Oi, {nome}! 👋 {qtd_texto} para você aprovar:\n\n{lista_conteudos}\n\nVeja e aprove pelo seu portal (aprovação, calendário, relatório e faturas num lugar só):\n👉 {link_portal}',
  '{1,2,3,4,5,6}'::smallint[], '09:00'::time, '{"start_hour":9,"end_hour":19}'::jsonb, '{"type":"all"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.wa_automations WHERE trigger = 'content_ready');
