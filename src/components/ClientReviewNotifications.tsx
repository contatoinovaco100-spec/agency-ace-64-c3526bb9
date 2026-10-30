import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { addNotification } from '@/lib/notificationHistory';
import { usePushNotification } from '@/hooks/usePushNotification';
import { CLIENT_REVIEW_AUTHOR, refreshClientReviews } from '@/lib/clientApprovals';

const ROLE_FIELDS = ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'script_writer'] as const;
const POLL_MS = 60 * 1000;

type CommentRow = { id: string; task_id: string; content: string; created_at: string };
type TaskRow = Record<(typeof ROLE_FIELDS)[number], string | null> & {
  id: string; title: string | null; video_name: string | null; client_id: string | null; task_type: string | null;
};

/**
 * Avisa a equipe quando um cliente aprova ou pede ajuste pelo link de conteúdo.
 * Recebem: admins, quem tem acesso ao Planner (social media) e quem está marcado na tarefa.
 * Lê os comentários novos da tarefa a cada minuto e ao voltar para a aba.
 */
export function ClientReviewNotifications() {
  const { user } = useAuth();
  const { isAdmin, hasPageAccess, loading } = usePageAccess();
  const { playSound } = usePushNotification();
  const navigate = useNavigate();
  const nameRef = useRef('');

  useEffect(() => {
    if (!user || loading) return;
    let cancelled = false;
    const key = `client-reviews:last-seen:${user.id}`;
    // Primeira vez: começa de agora, sem despejar o histórico antigo
    let lastSeen = (() => { try { return localStorage.getItem(key); } catch { return null; } })() || new Date().toISOString();
    const save = (iso: string) => { lastSeen = iso; try { localStorage.setItem(key, iso); } catch { /* sem storage */ } };
    save(lastSeen);

    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => { nameRef.current = (data?.full_name ?? '').trim().toLowerCase(); });

    const seesAll = isAdmin || hasPageAccess('/planner');

    const check = async () => {
      const { data: comments } = await supabase.from('task_comments')
        .select('id, task_id, content, created_at')
        .eq('author', CLIENT_REVIEW_AUTHOR)
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: true })
        .limit(20);
      const rows = (comments ?? []) as CommentRow[];
      if (cancelled || !rows.length) return;
      save(rows[rows.length - 1].created_at);
      refreshClientReviews();

      const ids = [...new Set(rows.map((r) => r.task_id))];
      const { data: tasks } = await supabase.from('tasks')
        .select(`id, title, video_name, client_id, task_type, ${ROLE_FIELDS.join(', ')}`).in('id', ids);
      const taskById = Object.fromEntries(((tasks ?? []) as unknown as TaskRow[]).map((t) => [t.id, t]));
      const clientIds = [...new Set(Object.values(taskById).map((t) => t.client_id).filter(Boolean))] as string[];
      const { data: clients } = clientIds.length
        ? await supabase.from('clients').select('id, company_name').in('id', clientIds)
        : { data: [] };
      const clientName = Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name]));
      if (cancelled) return;

      for (const r of rows) {
        const task = taskById[r.task_id];
        if (!task) continue;
        const mine = ROLE_FIELDS.some((f) => (task[f] || '').trim().toLowerCase() === nameRef.current && !!nameRef.current);
        if (!seesAll && !mine) continue;

        const approved = r.content.startsWith('✅');
        const who = (task.client_id && clientName[task.client_id]) || 'O cliente';
        const what = (task.video_name || task.title || 'conteúdo').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
        const note = approved ? '' : r.content.replace(/^[^\n]*\n?/, '').trim();
        const title = approved ? `✅ ${who} aprovou “${what}”` : `✏️ ${who} pediu ajuste em “${what}”`;

        addNotification(user.id, { title, description: note || (approved ? 'Pronto para agendar no Planner.' : 'Veja o pedido na tarefa.'), kind: 'task' });
        playSound(approved ? 'sale' : 'overdue');
        toast(title, {
          description: note || (approved ? 'Pronto para agendar no Planner.' : undefined),
          duration: 15000,
          action: {
            label: approved ? 'Agendar' : 'Ver tarefa',
            onClick: () => navigate(approved
              ? `/planner?cliente=todos&post=${task.id}&agendar=1`
              : `${task.task_type === 'Arte' ? '/artes' : '/tarefas'}?taskId=${task.id}`),
          },
        });
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener('visibilitychange', onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isAdmin]);

  return null;
}
