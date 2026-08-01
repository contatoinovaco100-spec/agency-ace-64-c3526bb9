import { supabase } from '@/integrations/supabase/client';
import type { PublishJob, PublishTarget, SocialAccount } from '@/types/social';

const JOBS = 'publish_jobs' as any;
const TARGETS = 'publish_targets' as any;
const BUCKET = 'instagram-media';

export interface CreateJobInput {
  file: File;
  caption: string;
  firstComment?: string;
  scheduledAt?: string | null;
  thumbnailUrl?: string;
  accounts: SocialAccount[];
  onProgress?: (pct: number) => void;
}

export const publishingService = {
  /** Faz upload do vídeo UMA única vez e cria o job + fila de destinos. */
  async createJob(input: CreateJobInput): Promise<PublishJob> {
    const ext = input.file.name.split('.').pop() || 'mp4';
    const path = `publish/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    input.onProgress?.(10);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, input.file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;
    input.onProgress?.(70);

    const { data: userData } = await supabase.auth.getUser();
    const isVideo = input.file.type.startsWith('video');

    const { data: job, error } = await supabase
      .from(JOBS)
      .insert({
        created_by: userData.user?.id ?? null,
        media_path: path,
        media_type: isVideo ? 'video' : 'image',
        caption: input.caption,
        first_comment: input.firstComment ?? '',
        thumbnail_url: input.thumbnailUrl ?? '',
        scheduled_at: input.scheduledAt || null,
        status: input.scheduledAt ? 'scheduled' : 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;

    const rows = input.accounts.map(a => ({
      job_id: (job as any).id,
      account_id: a.id,
      platform: a.platform,
      username: a.username,
      status: 'pending',
    }));
    const { error: tErr } = await supabase.from(TARGETS).insert(rows);
    if (tErr) throw tErr;

    input.onProgress?.(100);
    return job as unknown as PublishJob;
  },

  /** Dispara a publicação em paralelo (Edge Function). */
  async run(jobId: string) {
    const { data, error } = await supabase.functions.invoke('social-publish', {
      body: { job_id: jobId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async listJobs(limit = 100): Promise<PublishJob[]> {
    const { data, error } = await supabase
      .from(JOBS).select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as PublishJob[];
  },

  async listTargets(jobId?: string): Promise<PublishTarget[]> {
    let query = supabase.from(TARGETS).select('*').order('created_at');
    if (jobId) query = query.eq('job_id', jobId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as PublishTarget[];
  },

  async mediaUrl(path: string): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  },
};
