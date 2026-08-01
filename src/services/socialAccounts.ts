import { supabase } from '@/integrations/supabase/client';
import type { SocialAccount, SocialPlatform } from '@/types/social';

const TABLE = 'social_accounts' as any;

export const socialAccountsService = {
  async list(): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('platform')
      .order('username');
    if (error) throw error;
    return (data ?? []) as unknown as SocialAccount[];
  },

  async addManual(input: {
    platform: SocialPlatform;
    username: string;
    display_name?: string;
    profile_picture?: string;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        platform: input.platform,
        username: input.username,
        display_name: input.display_name || input.username,
        profile_picture: input.profile_picture || '',
        status: 'connected',
        external_id: null,
        last_synced_at: new Date().toISOString(),
        created_by: userData.user?.id ?? null,
      } as any)
      .select('*')
      .single();
    if (error) throw error;
    return data as unknown as SocialAccount;
  },

  async remove(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  /** Atualiza dados manuais da conta (marca como ativa e registra a data). */
  async touch(id: string, patch: Partial<SocialAccount> = {}) {
    const { error } = await supabase
      .from(TABLE)
      .update({ ...patch, status: 'connected', last_synced_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) throw error;
  },


  async getAuthUrl(platform: SocialPlatform, redirectUri: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('social-oauth', {
      body: { action: 'auth_url', platform, redirect_uri: redirectUri },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.url as string;
  },

  async connect(platform: SocialPlatform, code: string, redirectUri: string) {
    const { data, error } = await supabase.functions.invoke('social-oauth', {
      body: { action: 'connect', platform, code, redirect_uri: redirectUri },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { success: boolean; accounts: string[] };
  },

  async sync(accountId: string) {
    const { data, error } = await supabase.functions.invoke('social-oauth', {
      body: { action: 'sync', account_id: accountId },
    });
    if (error) throw error;
    return data as { success: boolean; status: string; details?: string };
  },
};
