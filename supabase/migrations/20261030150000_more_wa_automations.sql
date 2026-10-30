-- Mais Automações do WhatsApp: relacionamento, financeiro, produção, equipe e comercial.
-- Todas entram desligadas; a equipe revisa o texto e liga na página /automacoes.

-- WhatsApp de cada pessoa da equipe (lembretes individuais: tarefa nova, prazo, lead parado…)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

INSERT INTO public.wa_automations (name, description, trigger, template, days_of_week, send_time, params, audience)
SELECT * FROM (VALUES
  -- Cliente
  ('Boas-vindas', 'Assim que o contrato é assinado', 'welcome_contract',
   E'Oi, {nome}! 🎉 Seja muito bem-vindo(a) à INOVA!\n\nEstamos muito felizes com a parceria. Nos próximos dias você recebe o link do onboarding para a gente começar.\n\nTudo da sua marca vai ficar aqui: {link_portal}',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":20}'::jsonb, '{"type":"all"}'::jsonb),
  ('Onboarding parado', 'Onboarding sem avanço há alguns dias', 'onboarding_stalled',
   E'Oi, {nome}! 😊 Faltam só alguns passos do seu onboarding na INOVA para a gente começar a produzir.\n\nÉ rapidinho, dá para fazer pelo celular:\n👉 {link_onboarding}',
   '{1,2,3,4,5}'::smallint[], '10:30'::time, '{"days_after":3,"gap_days":3}'::jsonb, '{"type":"all"}'::jsonb),
  ('Pedido de ajuste recebido', 'Confirma ao cliente que o ajuste chegou', 'change_received',
   E'Recebemos seu pedido de ajuste em *{titulo}*, {nome}! ✏️\n\n"{pedido}"\n\nA equipe já está cuidando e te avisa quando estiver pronto.',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":20}'::jsonb, '{"type":"all"}'::jsonb),
  ('Conteúdo aprovado', 'Agradece a aprovação', 'approved_ack',
   E'Obrigado pela aprovação, {nome}! ✅\n\n*{titulo}* vai ao ar {data_post}.',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":20}'::jsonb, '{"type":"all"}'::jsonb),
  ('Aniversário de parceria', '6 meses e cada ano de contrato', 'partnership_anniversary',
   E'{nome}, hoje completamos *{tempo}* de parceria! 🥳\n\nObrigado pela confiança na INOVA. Bora pra muito mais!',
   '{0,1,2,3,4,5,6}'::smallint[], '10:00'::time, '{}'::jsonb, '{"type":"all"}'::jsonb),
  ('Pesquisa de satisfação', 'Pergunta mensal de 0 a 10', 'satisfaction_survey',
   E'Oi, {nome}! Uma pergunta rápida: de *0 a 10*, quanto você recomendaria a INOVA para um amigo, pensando no mês de {mes}?\n\nÉ só responder com o número (e, se quiser, o motivo). Isso ajuda muito a gente! 🙏',
   '{0,1,2,3,4,5,6}'::smallint[], '10:00'::time, '{"day_of_month":25}'::jsonb, '{"type":"all"}'::jsonb),
  -- Financeiro
  ('Pagamento confirmado', 'Quando a fatura é marcada como paga', 'payment_confirmed',
   E'Pagamento recebido, {nome}! ✅\n\n*{descricao}* — {valor}.\n\nObrigado! 💚',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":20}'::jsonb, '{"type":"all"}'::jsonb),
  ('Fatura nova', 'Quando uma fatura nova é gerada', 'invoice_created',
   E'Oi, {nome}! A fatura *{descricao}* de *{valor}* já está disponível, com vencimento em {vencimento}.\n\nPara pagar pelo Pix:\n👉 {link_fatura}',
   '{1,2,3,4,5}'::smallint[], '08:00'::time, '{"start_hour":9,"end_hour":18}'::jsonb, '{"type":"all"}'::jsonb),
  ('Contrato perto do fim', 'Renovação antes do fim do contrato', 'contract_ending',
   E'Oi, {nome}! Nosso contrato vai até *{fim_contrato}*.\n\nQue tal marcarmos uma conversa rápida para planejar os próximos meses? 🚀',
   '{1,2,3,4,5}'::smallint[], '10:00'::time, '{"days_before":30}'::jsonb, '{"type":"all"}'::jsonb),
  -- Produção
  ('Post publicado', 'Quando um post agendado vai ao ar', 'post_published',
   E'Seu post acabou de sair, {nome}! 🚀\n\n👉 {link_post}\n\nCurte, comenta e compartilha para dar aquele empurrão inicial! 💚',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":22}'::jsonb, '{"type":"all"}'::jsonb),
  ('Próxima semana', 'Posts da semana seguinte', 'next_week',
   E'Oi, {nome}! 📅 Na próxima semana vão ao ar {qtd} conteúdos no seu perfil:\n\n{lista_conteudos}\n\nBom fim de semana! 😊',
   '{5}'::smallint[], '16:00'::time, '{}'::jsonb, '{"type":"all"}'::jsonb),
  -- Equipe (cada pessoa)
  ('Tarefa nova para você', 'Avisa quem foi marcado numa tarefa nova', 'task_assigned',
   E'Oi, {pessoa}! 📌 Tem tarefa nova para você:\n\n*{titulo}* — {cliente}\nPrazo: {prazo}\n\n👉 {link_tarefa}',
   '{1,2,3,4,5}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":19}'::jsonb, '{"type":"all"}'::jsonb),
  ('Prazo vencendo', 'Entregas de amanhã ainda não prontas', 'deadline_tomorrow',
   E'Oi, {pessoa}! ⏰ Você tem {qtd} entrega(s) para *{data}*:\n\n{lista_tarefas}\n\nPrecisa de ajuda? Fala com a equipe!',
   '{0,1,2,3,4}'::smallint[], '17:00'::time, '{"days_before":1}'::jsonb, '{"type":"all"}'::jsonb),
  ('Roteiro pendente', 'Vídeo para gravar sem roteiro', 'script_missing',
   E'Oi, {pessoa}! ✍️ Estes vídeos vão para gravação e ainda estão sem roteiro:\n\n{lista_tarefas}',
   '{1,2,3,4,5}'::smallint[], '09:00'::time, '{"days_before":3}'::jsonb, '{"type":"all"}'::jsonb),
  ('Cliente pediu ajuste', 'Avisa a equipe do pedido do cliente', 'change_request_team',
   E'✏️ {pessoa}, o cliente *{cliente}* pediu ajuste em *{titulo}*:\n\n"{pedido}"\n\n👉 {link_tarefa}',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":20}'::jsonb, '{"type":"all"}'::jsonb),
  -- Equipe (grupo) e comercial: escolha o grupo da equipe ao ligar
  ('Gravações de amanhã', 'Agenda de gravações no grupo da equipe', 'shooting_team',
   E'🎬 *Gravações de {data}* ({qtd})\n\n{lista_gravacoes}',
   '{0,1,2,3,4,5,6}'::smallint[], '18:00'::time, '{"days_before":1}'::jsonb, '{"type":"team","to":""}'::jsonb),
  ('Clientes em risco', 'Clientes com atrasos ou fatura vencida', 'client_at_risk',
   E'⚠️ *Clientes que precisam de atenção* ({qtd})\n\n{lista_clientes}\n\n👉 {link_clientes}',
   '{1}'::smallint[], '09:00'::time, '{}'::jsonb, '{"type":"team","to":""}'::jsonb),
  ('Instagram desconectado', 'Contas sem acesso', 'instagram_disconnected',
   E'🔌 *{qtd} conta(s) do Instagram perderam o acesso*:\n\n{lista_contas}\n\nReconecte em Redes Sociais para não falhar o agendamento:\n👉 {link_redes}',
   '{1,2,3,4,5}'::smallint[], '08:00'::time, '{"start_hour":8,"end_hour":18}'::jsonb, '{"type":"team","to":""}'::jsonb),
  ('Venda fechada', 'Comemoração no grupo da equipe', 'sale_closed',
   E'🎉🎉 *VENDA FECHADA!* 🎉🎉\n\n*{empresa}* acabou de assinar — {valor}/mês. Bora fazer acontecer! 🚀',
   '{0,1,2,3,4,5,6}'::smallint[], '08:00'::time, '{"start_hour":7,"end_hour":23}'::jsonb, '{"type":"team","to":""}'::jsonb),
  ('Lead parado', 'Leads sem contato para o vendedor', 'lead_stalled',
   E'Oi, {pessoa}! 📈 Você tem {qtd} lead(s) sem contato há alguns dias:\n\n{lista_leads}\n\n👉 {link_crm}',
   '{1,2,3,4,5}'::smallint[], '09:30'::time, '{"days_after":3}'::jsonb, '{"type":"all"}'::jsonb)
) AS seed(name, description, trigger, template, days_of_week, send_time, params, audience)
WHERE NOT EXISTS (SELECT 1 FROM public.wa_automations a WHERE a.trigger = seed.trigger);
