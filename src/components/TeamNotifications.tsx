import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { usePushNotification } from '@/hooks/usePushNotification';
import { addNotification } from '@/lib/notificationHistory';
import type { ChatMessage } from '@/lib/chat';
import { mentionsUser } from '@/components/ChatMentions';

/**
 * Avisos da equipe que entram na central de notificações:
 * - alguém te mencionou no chat (@usuario ou @todos)
 * - chegou um lead novo no CRM (para quem tem acesso ao CRM)
 * - alguma tela quebrou no navegador de alguém (só admin; sem som, uma vez por mensagem)
 */
export function TeamNotifications() {
  const { user } = useAuth();
  const { hasPageAccess, isAdmin, loading } = usePageAccess();
  const { playSound } = usePushNotification();
  const navigate = useNavigate();
  const usernameRef = useRef<string | null>(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const soundRef = useRef(playSound);
  soundRef.current = playSound;
  const seesLeads = !loading && hasPageAccess('/crm');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => { usernameRef.current = data?.username ?? null; });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const notify = (entry: Parameters<typeof addNotification>[1], actionLabel: string) => {
      addNotification(user.id, entry);
      soundRef.current('default');
      toast(entry.title, {
        description: entry.description,
        duration: 10000,
        action: entry.link ? { label: actionLabel, onClick: () => navigateRef.current(entry.link!) } : undefined,
      });
    };

    let ch = supabase
      .channel(`team-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.author_id === user.id) return;
        // Conversa privada de outras pessoas não me diz respeito
        if (msg.channel.startsWith('dm_') && !msg.channel.includes(user.id)) return;
        if (!mentionsUser(msg.content, usernameRef.current)) return;
        notify({
          kind: 'mention',
          title: `${msg.author_name.split(' ')[0]} mencionou você`,
          description: msg.content.length > 140 ? `${msg.content.slice(0, 140)}…` : msg.content,
          link: `/chat?canal=${msg.channel}`,
        }, 'Responder');
      });

    if (seesLeads) {
      ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const lead = payload.new as { name?: string; company?: string; source?: string };
        notify({
          kind: 'lead',
          title: `Novo lead: ${lead.company || lead.name || 'sem nome'}`,
          description: [lead.name !== lead.company ? lead.name : null, lead.source].filter(Boolean).join(' · ') || undefined,
          link: '/crm',
        }, 'Abrir CRM');
      });
    }

    if (isAdmin) {
      const seenErrors = new Set<string>();
      ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_errors' }, (payload) => {
        const err = payload.new as { message: string; path: string | null; user_email: string | null; kind: string };
        if (err.kind === 'chunk' || seenErrors.has(err.message)) return;
        seenErrors.add(err.message);
        addNotification(user.id, {
          kind: 'error',
          title: `Erro em ${(err.path ?? '').split('?')[0] || 'uma tela'}`,
          description: `${err.message.slice(0, 120)}${err.user_email ? ` · ${err.user_email}` : ''}`,
          link: '/erros',
        });
      });
    }

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, seesLeads, isAdmin]);

  return null;
}
