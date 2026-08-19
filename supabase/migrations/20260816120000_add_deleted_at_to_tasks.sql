-- Adiciona coluna deleted_at para soft delete de tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Índice para consultas rápidas de tarefas não-deletadas
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks (deleted_at) WHERE deleted_at IS NULL;