import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { socialAccountsService } from '@/services/socialAccounts';
import type { SocialAccount, SocialPlatform } from '@/types/social';

export function useSocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      setAccounts(await socialAccountsService.list());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Atualiza em tempo real quando contas são criadas/alteradas/removidas
  useEffect(() => {
    const channel = supabase
      .channel('social-accounts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_accounts' },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  // Recarrega ao voltar para a aba/janela
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  const byPlatform = (platform: SocialPlatform) => accounts.filter(a => a.platform === platform);

  return { accounts, byPlatform, loading, refreshing, error, reload };
}
