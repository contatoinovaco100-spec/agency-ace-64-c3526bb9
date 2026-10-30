-- Relatório de produção para os gestores (Automações do WhatsApp): meio-dia e fim do dia, desligados.
-- Na página /automacoes, escolha o grupo dos gestores ou digite os números separados por vírgula e ligue.
INSERT INTO public.wa_automations (name, description, trigger, template, days_of_week, send_time, params, audience)
SELECT * FROM (VALUES
  ('Produção do dia — meio-dia', 'Parcial da produção para os gestores', 'manager_report',
   E'📊 *Parcial da produção — {data} ({hora})*\n\n🎬 Finalizados hoje: *{finalizados_hoje}* ({videos_finalizados_hoje} vídeos)\n{lista_finalizados}\n\n✅ Concluídos hoje: *{concluidos_hoje}*\n👍 Aprovados pelos clientes: *{aprovados_hoje}*\n✏️ Foram para revisão: {revisao_hoje} · 🔁 Alterações: {alteracoes_hoje}\n\n🏆 {ranking_equipe}',
   '{1,2,3,4,5}'::smallint[], '12:00'::time, '{}'::jsonb, '{"type":"team","to":""}'::jsonb),
  ('Produção do dia — fechamento', 'Fechamento do dia para os gestores', 'manager_report',
   E'📊 *Fechamento da produção — {data}*\n\n🎬 Finalizados hoje: *{finalizados_hoje}* ({videos_finalizados_hoje} vídeos)\n{lista_finalizados}\n\n✅ Concluídos/postados hoje: *{concluidos_hoje}*\n{lista_concluidos}\n\n👍 Aprovados pelos clientes: *{aprovados_hoje}*\n✏️ Foram para revisão: {revisao_hoje} · 🔁 Voltaram para alteração: {alteracoes_hoje}\n📦 Em Finalizado agora: {em_finalizado_agora} · ⏰ Posts atrasados: {atrasados}\n\n🏆 Quem mais movimentou: {ranking_equipe}',
   '{1,2,3,4,5}'::smallint[], '18:30'::time, '{}'::jsonb, '{"type":"team","to":""}'::jsonb)
) AS seed(name, description, trigger, template, days_of_week, send_time, params, audience)
WHERE NOT EXISTS (SELECT 1 FROM public.wa_automations a WHERE a.trigger = 'manager_report');
