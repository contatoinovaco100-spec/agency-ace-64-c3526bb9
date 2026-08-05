import { supabase } from '@/integrations/supabase/client';

export function extractVideoPath(url: string): string | null {
  const m = url.match(/\/task-videos\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function resolveVideoUrl(url: string): Promise<string> {
  if (!/supabase\.co\/storage/i.test(url)) return url;
  const path = extractVideoPath(url);
  if (!path) return url;
  const { data } = await supabase.storage.from('task-videos').createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || url;
}
