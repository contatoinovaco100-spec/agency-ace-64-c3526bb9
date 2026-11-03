-- Lembretes da equipe: mais de um horário por dia (ex.: 08:00 e 14:00).
-- last_slot guarda o último horário enviado ("2026-11-03 14:00") para não repetir o mesmo horário.
ALTER TABLE public.team_reminders ADD COLUMN IF NOT EXISTS send_times TEXT[] NOT NULL DEFAULT '{08:00}';
ALTER TABLE public.team_reminders ADD COLUMN IF NOT EXISTS last_slot TEXT;

-- Quem já tinha um horário diferente de 08:00 passa a ter esse horário na lista
UPDATE public.team_reminders
SET send_times = ARRAY[to_char(send_time, 'HH24:MI')]
WHERE send_times = '{08:00}' AND to_char(send_time, 'HH24:MI') <> '08:00';