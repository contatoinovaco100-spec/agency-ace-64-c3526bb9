import { useEffect, useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/*
 * Quem está com a plataforma aberta agora (Presence do Realtime, sem tabela no banco).
 * Um único canal por aba, compartilhado por todos os componentes que perguntam.
 */
let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;
let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

function connect(userId: string) {
  if (channel && channelUser === userId) return;
  if (channel) supabase.removeChannel(channel);
  channelUser = userId;
  channel = supabase.channel('presence-online', { config: { presence: { key: userId } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      online = new Set(Object.keys(channel?.presenceState() ?? {}));
      notify();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel?.track({ since: new Date().toISOString() });
    });
}

function disconnect() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  channelUser = null;
  online = new Set();
  notify();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => online;

/** Conjunto de ids de usuários online (inclui você) */
export function useOnlineUsers() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) connect(user.id);
    else disconnect();
  }, [user]);
  return useSyncExternalStore(subscribe, snapshot);
}
