CREATE TABLE IF NOT EXISTS public.shooting_booking_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weekdays INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_minutes INT NOT NULL DEFAULT 120 CHECK (slot_minutes BETWEEN 15 AND 720),
  min_notice_days INT NOT NULL DEFAULT 1 CHECK (min_notice_days >= 0),
  horizon_days INT NOT NULL DEFAULT 30 CHECK (horizon_days BETWEEN 1 AND 180),
  blocked_dates DATE[] NOT NULL DEFAULT '{}',
  location TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.shooting_booking_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shooting_booking_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe lê a agenda de captação" ON public.shooting_booking_settings;
CREATE POLICY "Equipe lê a agenda de captação" ON public.shooting_booking_settings FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Admin altera a agenda de captação" ON public.shooting_booking_settings;
CREATE POLICY "Admin altera a agenda de captação" ON public.shooting_booking_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.shooting_booking_settings TO authenticated;
GRANT ALL ON public.shooting_booking_settings TO service_role;

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
    SELECT days.day, (s.start_time + make_interval(mins => n * s.slot_minutes))::time AS t, s.slot_minutes
    FROM days, s,
      generate_series(0, floor(extract(epoch FROM (s.end_time - s.start_time)) / 60 / s.slot_minutes)::int - 1) n
  )
  SELECT slots.day, slots.t
  FROM slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.shooting_schedules x
    WHERE x.shooting_date = slots.day
      AND coalesce(x.status, '') NOT ILIKE 'cancel%'
      AND (
        x.start_time IS NULL
        OR (x.start_time < (slots.t + make_interval(mins => slots.slot_minutes))::time
            AND coalesce(x.end_time, (x.start_time + make_interval(mins => slots.slot_minutes))::time) > slots.t)
      )
  )
  ORDER BY 1, 2
$$;
REVOKE ALL ON FUNCTION public.shooting_free_slots(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shooting_free_slots(DATE, DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_booking_page(p_client UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shooting_booking_settings;
  c record;
  today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO s FROM public.shooting_booking_settings WHERE id = 1;
  SELECT id, company_name INTO c FROM public.clients
    WHERE id = p_client AND deleted_at IS NULL AND coalesce(status, '') <> 'Cancelado';
  IF c.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'client', c.company_name,
    'location', s.location,
    'slot_minutes', s.slot_minutes,
    'slots', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', f.slot_date, 'time', to_char(f.slot_time, 'HH24:MI')) ORDER BY f.slot_date, f.slot_time)
      FROM public.shooting_free_slots(today + s.min_notice_days, today + s.horizon_days) f
    ), '[]'::jsonb),
    'booked', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', x.shooting_date, 'time', to_char(x.start_time, 'HH24:MI')) ORDER BY x.shooting_date)
      FROM public.shooting_schedules x
      WHERE x.client_id = c.id AND x.shooting_date >= today AND coalesce(x.status, '') NOT ILIKE 'cancel%'
    ), '[]'::jsonb)
  );
END
$$;
REVOKE ALL ON FUNCTION public.get_booking_page(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_page(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_shooting(p_client UUID, p_date DATE, p_time TIME)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shooting_booking_settings;
  c record;
  today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  new_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('shooting-booking'));
  SELECT * INTO s FROM public.shooting_booking_settings WHERE id = 1;
  SELECT id, company_name INTO c FROM public.clients
    WHERE id = p_client AND deleted_at IS NULL AND coalesce(status, '') <> 'Cancelado';
  IF c.id IS NULL THEN RAISE EXCEPTION 'Link de agendamento inválido'; END IF;
  IF p_date < today + s.min_notice_days OR p_date > today + s.horizon_days
     OR NOT EXISTS (SELECT 1 FROM public.shooting_free_slots(p_date, p_date) f WHERE f.slot_time = p_time) THEN
    RAISE EXCEPTION 'Esse horário não está mais livre. Escolha outro.';
  END IF;
  INSERT INTO public.shooting_schedules (title, client_id, shooting_date, start_time, end_time, location, status, notes)
  VALUES ('Captação ' || c.company_name, c.id, p_date, p_time, (p_time + make_interval(mins => s.slot_minutes))::time,
          s.location, 'Agendada', 'Marcada pelo cliente no link de agendamento')
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'date', p_date, 'time', to_char(p_time, 'HH24:MI'));
END
$$;
REVOKE ALL ON FUNCTION public.book_shooting(UUID, DATE, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_shooting(UUID, DATE, TIME) TO anon, authenticated, service_role;