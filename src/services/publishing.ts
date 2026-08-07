import { supabase } from '@/integrations/supabase/client';
import type { PublishJob, PublishTarget, SocialAccount } from '@/types/social';

const JOBS = 'publish_jobs' as any;
const TARGETS = 'publish_targets' as any;
const BUCKET = 'instagram-media';

export type PostType = 'auto' | 'reels' | 'image' | 'stories' | 'carousel';

export interface CreateJobInput {
  /** Uma mídia (compatibilidade) ou várias (carrossel) */
  file?: File;
  files?: File[];
  caption: string;
  firstComment?: string;
  scheduledAt?: string | null;
  thumbnailUrl?: string;
  postType?: PostType;
  shareToFeed?: boolean;
  collaborators?: string[];
  locationId?: string;
  userTags?: string[];
  coverUrl?: string;
  thumbOffset?: number;
  audioName?: string;
  accounts: SocialAccount[];
  onProgress?: (pct: number) => void;
}



/** Instagram só aceita JPEG em fotos — converte qualquer imagem para JPEG e limita a 1440px. */
async function toInstagramJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const max = 1440;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao converter imagem'))), 'image/jpeg', 0.92),
  );
  return new File([blob], 'post.jpg', { type: 'image/jpeg' });
}

export const publishingService = {
  /** Faz upload do vídeo UMA única vez e cria o job + fila de destinos. */
  async createJob(input: CreateJobInput): Promise<PublishJob> {
    const sources = (input.files && input.files.length ? input.files : (input.file ? [input.file] : []))
      .slice(0, 10);
    if (!sources.length) throw new Error('Nenhuma mídia selecionada');

    const paths: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const isVid = src.type.startsWith('video');
      const file = isVid ? src : await toInstagramJpeg(src);
      const ext = isVid ? (file.name.split('.').pop() || 'mp4').toLowerCase() : 'jpg';
      const path = `publish/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: isVid ? (file.type || 'video/mp4') : 'image/jpeg',
        });
      if (upErr) throw upErr;
      paths.push(path);
      input.onProgress?.(10 + Math.round(((i + 1) / sources.length) * 60));
    }

    const isVideo = sources[0].type.startsWith('video');
    input.onProgress?.(70);

    const { data: userData } = await supabase.auth.getUser();

    // Normaliza a data agendada para UTC (ISO com Z). O campo datetime-local
    // envia "2026-08-07T15:30" (horário local, sem fuso) — sem a conversão, o
    // cron (que compara strings em UTC) entenderia o horário 3h antes.
    const scheduledIso = input.scheduledAt ? (() => {
      const d = new Date(input.scheduledAt);
      return isNaN(d.getTime()) ? input.scheduledAt : d.toISOString();
    })() : null;


    const { data: job, error } = await supabase
      .from(JOBS)
      .insert({
        created_by: userData.user?.id ?? null,
        media_path: paths[0],
        media_paths: paths,
        media_type: isVideo ? 'video' : 'image',

        caption: input.caption,
        first_comment: input.firstComment ?? '',
        thumbnail_url: input.thumbnailUrl ?? '',
        scheduled_at: scheduledIso,
        status: input.scheduledAt ? 'scheduled' : 'pending',
        post_type: input.postType ?? 'auto',
        share_to_feed: input.shareToFeed !== false,
        collaborators: (input.collaborators ?? []).map(c => c.replace(/^@/, '').trim()).filter(Boolean),
        location_id: input.locationId ?? '',
        user_tags: (input.userTags ?? [])
          .map(u => u.replace(/^@/, '').trim())
          .filter(Boolean)
          .map(username => ({ username, x: 0.5, y: 0.5 })),
        cover_url: input.coverUrl ?? '',
        thumb_offset: input.thumbOffset ?? 0,
        audio_name: input.audioName ?? '',
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

  /** Dispara a publicação real em paralelo (Edge Function). */
  async run(jobId: string) {
    const { data, error } = await supabase.functions.invoke('social-publish', {
      body: { job_id: jobId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { success: boolean; targets: number };
  },

  /** Recupera jobs travados em 'processing' (targets 'publishing' → 'pending').
   *  Quando o background do social-publish é encerrado (timeout do Edge Runtime)
   *  no meio de uma publicação, job fica 'processing' e target 'publishing'
   *  para sempre — nada mais os reprocessa. Esta função os desbloqueia. */
  async recoverStuckJobs(): Promise<string[]> {
    const STUCK_MS = 10 * 60 * 1000;
    const { data: jobs, error } = await supabase
      .from(JOBS)
      .select('id, status, scheduled_at, updated_at')
      .eq('status', 'processing');
    if (error) throw error;
    if (!jobs?.length) return [];

    const recovered: string[] = [];
    for (const job of jobs) {
      const updated = (job as any).updated_at ? new Date((job as any).updated_at).getTime() : 0;
      // Publicação real pode levar alguns minutos — só recupera se realmente travou.
      if (!updated || Date.now() - updated < STUCK_MS) continue;

      await supabase
        .from(TARGETS)
        .update({ status: 'pending', error_message: '' } as any)
        .eq('job_id', (job as any).id)
        .in('status', ['publishing']);

      // Volta para 'scheduled' (mesmo vencido) para o pipeline existente
      // (auto-publish do navegador + cron) republicar. Só vira 'pending'
      // se nunca foi agendado.
      const status = (job as any).scheduled_at ? 'scheduled' : 'pending';
      await supabase.from(JOBS).update({ status } as any).eq('id', (job as any).id);
      recovered.push((job as any).id);
    }
    return recovered;
  },

  /** Reprocessa todos os jobs que já venceram e ainda não foram publicados.
   *  Antes, recupera os travados em 'processing'. Jobs agendados para o
   *  futuro NÃO são publicados aqui. */
  async reprocessPending(): Promise<{ processed: number; errors: number }> {
    await this.recoverStuckJobs();

    const now = Date.now();
    const { data: jobs, error } = await supabase
      .from(JOBS)
      .select('id, status, scheduled_at')
      .in('status', ['pending', 'scheduled']);
    if (error) throw error;
    if (!jobs?.length) return { processed: 0, errors: 0 };

    let processed = 0;
    let errors = 0;
    for (const job of jobs) {
      const j = job as any;
      // Nunca publica agendados futuros por aqui (só cron/timer do navegador).
      if (j.scheduled_at && new Date(j.scheduled_at).getTime() > now) continue;
      try {
        await this.run(j.id);
        processed++;
      } catch {
        errors++;
      }
    }
    return { processed, errors };
  },

  /** Cancela um job (marca como 'failed') e remove targets pendentes. */
  async cancelJob(jobId: string) {
    const { error } = await supabase
      .from(JOBS)
      .update({ status: 'failed' } as any)
      .eq('id', jobId)
      .in('status', ['pending', 'scheduled']);
    if (error) throw error;
  },

  /** Exclui um job e seus targets do banco. */
  async deleteJob(jobId: string) {
    await supabase.from(TARGETS).delete().eq('job_id', jobId);
    const { error } = await supabase.from(JOBS).delete().eq('id', jobId);
    if (error) throw error;
  },

  /** Marca uma conta como publicada/pendente manualmente. */

  async markTarget(targetId: string, status: 'pending' | 'published') {
    const { error } = await supabase
      .from(TARGETS)
      .update({
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
      } as any)
      .eq('id', targetId);
    if (error) throw error;
  },

  /** Recalcula o status do job a partir dos destinos. */
  async refreshJobStatus(jobId: string) {
    const targets = await this.listTargets(jobId);
    const done = targets.filter(t => t.status === 'published').length;
    const status = done === 0 ? 'pending' : done === targets.length ? 'published' : 'partial';
    await supabase.from(JOBS).update({ status } as any).eq('id', jobId);
    return status;
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
