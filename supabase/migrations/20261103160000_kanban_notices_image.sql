-- Avisos do kanban: foto opcional (arquivo no bucket task-attachments, pasta avisos/)
ALTER TABLE public.kanban_notices ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
