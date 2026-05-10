-- Add missing button_label and button_final_label columns to quizzes table
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS button_label text NOT NULL DEFAULT 'Continuar',
  ADD COLUMN IF NOT EXISTS button_final_label text NOT NULL DEFAULT 'Ver meu resultado';
