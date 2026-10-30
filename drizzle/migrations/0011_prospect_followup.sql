-- Prospecção → CRM: cada campanha escolhe a sequência de follow-up de quem responder (se interessou).
ALTER TABLE public.prospect_campaigns
  ADD COLUMN IF NOT EXISTS followup_sequence_id uuid REFERENCES public.crm_sequences(id) ON DELETE SET NULL;

-- Sequência pronta para os interessados da prospecção (desligada: revise o texto e ligue na aba Follow-up do CRM)
INSERT INTO public.crm_sequences (name, steps, stop_on_reply, start_hour, end_hour, weekdays_only, auto_enroll_new, active)
SELECT 'Follow-up prospecção (respondeu)', jsonb_build_array(
  jsonb_build_object('day', 1, 'message', E'Oi, {nome}! Passando para continuar nossa conversa de ontem 🙂\n\nConsigo te mostrar em 15 minutos como trabalhamos o Instagram de empresas como a sua. Qual o melhor horário para você essa semana?'),
  jsonb_build_object('day', 3, 'message', E'{nome}, separei alguns vídeos que fizemos para clientes parecidos com vocês. Posso te mandar por aqui?'),
  jsonb_build_object('day', 7, 'message', E'Oi, {nome}! Vou deixar seu contato separado por aqui para não te incomodar. Quando quiser retomar, é só me chamar 👋')
), true, 9, 18, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.crm_sequences WHERE name = 'Follow-up prospecção (respondeu)');