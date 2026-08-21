export type SocialPlatform = 'instagram' | 'tiktok' | 'threads';

export type AccountStatus = 'connected' | 'expired' | 'disconnected';

export interface SocialAccount {
  id: string;
  client_id: string | null;
  platform: SocialPlatform;
  external_id: string | null;
  username: string;
  display_name: string;
  profile_picture: string;
  status: AccountStatus;
  expires_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type JobStatus = 'pending' | 'processing' | 'published' | 'partial' | 'failed' | 'scheduled';
export type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface PublishJob {
  id: string;
  created_by: string | null;
  client_id: string | null;
  media_path: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string;
  caption: string;
  first_comment: string;
  scheduled_at: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface PublishTarget {
  id: string;
  job_id: string;
  account_id: string | null;
  platform: SocialPlatform;
  username: string;
  status: TargetStatus;
  error_message: string;
  remote_post_id: string;
  permalink: string;
  published_at: string | null;
  created_at: string;
}

export const PLATFORM_META: Record<SocialPlatform, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-500' },
  tiktok: { label: 'TikTok', color: 'text-cyan-400' },
  threads: { label: 'Threads', color: 'text-gray-200' },
};

export const STATUS_LABEL: Record<AccountStatus, string> = {
  connected: 'Conectado',
  expired: 'Token expirado',
  disconnected: 'Desconectado',
};
