import { PlatformAdapter } from "./types.ts";
import { instagramAdapter } from "./instagram.ts";
import { tiktokAdapter } from "./tiktok.ts";

// Registre novos adaptadores aqui (facebook, linkedin, youtube, pinterest, x, threads...)
export const adapters: Record<string, PlatformAdapter> = {
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
};

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Plataforma não suportada: ${platform}`);
  return adapter;
}
