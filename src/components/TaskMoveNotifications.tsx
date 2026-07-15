import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addHistoryEntry } from '@/lib/taskMoveHistory';
import { usePushNotification } from '@/hooks/usePushNotification';


const ROLE_FIELDS = ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'script_writer'] as const;

/**
 * Notifica o funcionário marcado numa tarefa quando ela muda de coluna no kanban.
 * Toca um som + toast + notificação nativa (se permitida).
 */
export function TaskMoveNotifications() {
  const { user } = useAuth();
  const { playSound } = usePushNotification();
  const fullNameRef = useRef<string>('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      fullNameRef.current = (profile?.full_name ?? '').trim().toLowerCase();
    })();

    const channel = supabase
      .channel('task-move-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          const newRow: any = payload.new;
          const oldRow: any = payload.old;
          if (!newRow || !oldRow) return;
          if (newRow.status === oldRow.status) return;

          const me = fullNameRef.current;
          if (!me) return;

          const isMine = ROLE_FIELDS.some(
            (f) => (newRow[f] || '').trim().toLowerCase() === me
          );
          if (!isMine) return;

          addHistoryEntry(user.id, {
            taskId: newRow.id,
            title: newRow.title || newRow.video_name || 'Tarefa',
            fromStatus: oldRow.status,
            toStatus: newRow.status,
            taskType: newRow.task_type ?? null,
            clientId: newRow.client_id ?? null,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;

          const me = fullNameRef.current;
          if (!me) return;

          const isMine = ROLE_FIELDS.some(
            (f) => (row[f] || '').trim().toLowerCase() === me
          );
          if (!isMine) return;

          const title = row.title || row.video_name || 'Tarefa';

          addHistoryEntry(user.id, {
            taskId: row.id,
            title,
            fromStatus: '—',
            toStatus: row.status || 'A fazer',
            taskType: row.task_type ?? null,
            clientId: row.client_id ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
