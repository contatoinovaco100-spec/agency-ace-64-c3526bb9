import { useCallback, useEffect, useState } from 'react';
import { socialAccountsService } from '@/services/socialAccounts';
import type { SocialAccount, SocialPlatform } from '@/types/social';

export function useSocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setAccounts(await socialAccountsService.list());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const byPlatform = (platform: SocialPlatform) => accounts.filter(a => a.platform === platform);

  return { accounts, byPlatform, loading, error, reload };
}
