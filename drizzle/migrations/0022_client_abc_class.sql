-- Curva ABC dos clientes: a letra é calculada pelo valor mensal; esta coluna guarda só a letra
-- escolhida à mão (NULL = automática)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C'));