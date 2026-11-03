-- Agendamento de captação: mais de uma equipe gravando no mesmo horário.
-- Um horário só fecha quando o número de gravações nele chega a teams_per_slot.
-- Gravação sem horário agora ocupa uma equipe o dia todo (antes fechava o dia inteiro).

ALTER TABLE public.shooting_booking_settings
  ADD COLUMN IF NOT EXISTS teams_per_slot INT NOT NULL DEFAULT 2 CHECK (teams_per_slot BETWEEN 1 AND 20);

CREATE OR REPLACE FUNCTION public.shooting_free_slots(p_from DATE, p_to DATE)
RETURNS TABLE (slot_date DATE, slot_time TIME)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT * FROM public.shooting_booking_settings WHERE id = 1),
  days AS (
    SELECT d::date AS day
    FROM s, generate_series(p_from, p_to, interval '1 day') d
    WHERE extract(dow FROM d)::int = ANY (s.weekdays) AND NOT (d::date = ANY (s.blocked_dates))
  ),
  slots AS (
    SELECT days.day, (s.start_time + make_interval(mins => n * s.slot_minutes))::time AS t, s.slot_minutes, s.teams_per_slot
    FROM days, s,
      generate_series(0, floor(extract(epoch FROM (s.end_time - s.start_time)) / 60 / s.slot_minutes)::int - 1) n
  )
  SELECT slots.day, slots.t
  FROM slots
  WHERE (
    SELECT count(*) FROM public.shooting_schedules x
    WHERE x.shooting_date = slots.day
      AND coalesce(x.status, '') NOT ILIKE 'cancel%'
      AND (
        x.start_time IS NULL
        OR (x.start_time < (slots.t + make_interval(mins => slots.slot_minutes))::time
            AND coalesce(x.end_time, (x.start_time + make_interval(mins => slots.slot_minutes))::time) > slots.t)
      )
  ) < slots.teams_per_slot
  ORDER BY 1, 2
$$;
REVOKE ALL ON FUNCTION public.shooting_free_slots(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shooting_free_slots(DATE, DATE) TO authenticated, service_role;
