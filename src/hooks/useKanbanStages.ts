import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type KanbanBoard = 'tasks' | 'crm' | 'artes' | 'pre';

export interface KanbanStage {
  id: string;
  board: KanbanBoard;
  name: string;
  position: number;
  color: string;
  is_system: boolean;
}

/** Default fallbacks shown while loading or if the table is empty. */
const FALLBACKS: Record<KanbanBoard, Omit<KanbanStage, 'id'>[]> = {
  tasks: [
    { board: 'tasks', name: 'Ideias / Backlog', position: 0, color: 'muted',       is_system: false },
    { board: 'tasks', name: 'Em Copy',          position: 1, color: 'primary',     is_system: false },
    { board: 'tasks', name: 'Em Direção',       position: 2, color: 'info',        is_system: false },
    { board: 'tasks', name: 'Em Gravação',      position: 3, color: 'warning',     is_system: false },
    { board: 'tasks', name: 'Em Edição',        position: 4, color: 'accent',      is_system: false },
    { board: 'tasks', name: 'Revisão',          position: 5, color: 'destructive', is_system: false },
    { board: 'tasks', name: 'Finalizado',       position: 6, color: 'success',     is_system: true },
    { board: 'tasks', name: 'Concluído',        position: 7, color: 'muted',       is_system: true },
  ],
  artes: [
    { board: 'artes', name: 'Ideias / Backlog', position: 0, color: 'muted',       is_system: false },
    { board: 'artes', name: 'Em Copy',          position: 1, color: 'primary',     is_system: false },
    { board: 'artes', name: 'Em Direção',       position: 2, color: 'info',        is_system: false },
    { board: 'artes', name: 'Em Edição',        position: 3, color: 'accent',      is_system: false },
    { board: 'artes', name: 'Revisão',          position: 4, color: 'destructive', is_system: false },
    { board: 'artes', name: 'Finalizado',       position: 5, color: 'success',     is_system: true },
    { board: 'artes', name: 'Concluído',        position: 6, color: 'muted',       is_system: true },
  ],
  crm: [
    { board: 'crm', name: 'Lead novo',         position: 0, color: 'info',        is_system: false },
    { board: 'crm', name: 'Contato iniciado',  position: 1, color: 'primary',     is_system: false },
    { board: 'crm', name: 'Reunião agendada',  position: 2, color: 'warning',     is_system: false },
    { board: 'crm', name: 'Proposta enviada',  position: 3, color: 'success',     is_system: false },
    { board: 'crm', name: 'Negociação',        position: 4, color: 'primary',     is_system: false },
    { board: 'crm', name: 'Cliente fechado',   position: 5, color: 'success',     is_system: true },
    { board: 'crm', name: 'Perdido',           position: 6, color: 'destructive', is_system: true },
  ],
};

export const STAGE_COLORS = [
  { value: 'muted',       label: 'Cinza',    swatch: 'bg-muted-foreground' },
  { value: 'primary',     label: 'Lime',     swatch: 'bg-primary' },
  { value: 'info',        label: 'Azul',     swatch: 'bg-info' },
  { value: 'warning',     label: 'Amarelo',  swatch: 'bg-warning' },
  { value: 'accent',      label: 'Roxo',     swatch: 'bg-accent-foreground' },
  { value: 'destructive', label: 'Vermelho', swatch: 'bg-destructive' },
  { value: 'success',     label: 'Verde',    swatch: 'bg-success' },
];

export function colorClasses(color: string) {
  switch (color) {
    case 'primary':     return { bg: 'bg-primary/8 border-primary/30',         dot: 'bg-primary',            border: 'border-l-primary' };
    case 'info':        return { bg: 'bg-info/8 border-info/30',               dot: 'bg-info',               border: 'border-l-info' };
    case 'warning':     return { bg: 'bg-warning/8 border-warning/30',         dot: 'bg-warning',            border: 'border-l-warning' };
    case 'accent':      return { bg: 'bg-accent border-accent-foreground/20', dot: 'bg-accent-foreground',  border: 'border-l-accent-foreground' };
    case 'destructive': return { bg: 'bg-destructive/8 border-destructive/30', dot: 'bg-destructive',        border: 'border-l-destructive' };
    case 'success':     return { bg: 'bg-success/8 border-success/30',         dot: 'bg-success',            border: 'border-l-success' };
    case 'muted':
    default:            return { bg: 'bg-muted/60 border-muted-foreground/20', dot: 'bg-muted-foreground',   border: 'border-l-muted-foreground/60' };
  }
}

export function useKanbanStages(board: KanbanBoard) {
  const [stages, setStages] = useState<KanbanStage[]>(
    FALLBACKS[board].map((s, i) => ({ ...s, id: `fallback-${i}` })),
  );
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('kanban_stages')
      .select('*')
      .eq('board', board)
      .order('position', { ascending: true });
    if (!error && data && data.length > 0) {
      setStages(data as KanbanStage[]);
    }
    setLoading(false);
  }, [board]);

  useEffect(() => { refetch(); }, [refetch]);

  const addStage = useCallback(async (name: string, color = 'muted') => {
    const maxPos = stages.reduce((m, s) => Math.max(m, s.position), -1);
    const { error } = await supabase.from('kanban_stages').insert({
      board, name, color, position: maxPos + 1, is_system: false,
    });
    if (error) throw error;
    await refetch();
  }, [board, stages, refetch]);

  const renameStage = useCallback(async (oldName: string, newName: string) => {
    const { error } = await supabase.rpc('rename_kanban_stage', {
      _board: board, _old_name: oldName, _new_name: newName,
    });
    if (error) throw error;
    await refetch();
  }, [board, refetch]);

  const updateStageColor = useCallback(async (id: string, color: string) => {
    const { error } = await supabase.from('kanban_stages').update({ color }).eq('id', id);
    if (error) throw error;
    await refetch();
  }, [refetch]);

  const deleteStage = useCallback(async (id: string) => {
    const { error } = await supabase.from('kanban_stages').delete().eq('id', id);
    if (error) throw error;
    await refetch();
  }, [refetch]);

  const reorder = useCallback(async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('kanban_stages').update({ position: idx }).eq('id', id),
      ),
    );
    await refetch();
  }, [refetch]);

  return { stages, loading, refetch, addStage, renameStage, updateStageColor, deleteStage, reorder };
}
