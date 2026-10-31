import { supabase } from '@/integrations/supabase/client';

type Kind = 'diagnostic' | 'ads' | 'social';
const TABLE: Record<Kind, 'diagnostics' | 'ads_audits' | 'social_audits'> = {
  diagnostic: 'diagnostics', ads: 'ads_audits', social: 'social_audits',
};

/**
 * Relatório público pelo link. Usa a função do banco (que não deixa listar os outros);
 * enquanto a migração não estiver aplicada, cai na leitura direta para o link não quebrar.
 */
export async function fetchPublicReport<T>(kind: Kind, slug: string): Promise<{ data: T | null; error: unknown }> {
  const { data, error } = await supabase.rpc('get_public_report' as never, { _kind: kind, _slug: slug } as never);
  if (!error) return { data: data as T | null, error: null };
  if ((error as { code?: string }).code !== 'PGRST202') return { data: null, error };
  const res = await supabase.from(TABLE[kind]).select('*').eq('slug', slug).maybeSingle();
  return { data: res.data as T | null, error: res.error };
}
