import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModuleAccess } from '@/hooks/useUserRole';
import { addNotification } from '@/lib/notificationHistory';

export function RealtimeNotifications() {
  const { user } = useAuth();
  const { isAdmin } = useModuleAccess();

  useEffect(() => {
    if (!isAdmin || !user) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts' },
        (payload) => {
          const contract: any = payload.new;
          const old: any = payload.old;
          if (contract.status === 'assinado' && old?.status !== 'assinado') {
            addNotification(user.id, {
              title: 'Venda Confirmada! 💰',
              description: `O contrato "${contract.title}" foi assinado por ${contract.client_name}.`,
              kind: 'sale',
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contract_signatures' },
        (payload) => {
          const sig: any = payload.new;
          addNotification(user.id, {
            title: 'Nova Assinatura! ✍️',
            description: `${sig.signer_name} acabou de assinar um contrato.`,
            kind: 'signature',
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user]);

  return null;
}
