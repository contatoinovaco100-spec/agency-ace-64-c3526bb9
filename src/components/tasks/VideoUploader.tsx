import { useRef, useState, useCallback } from 'react';
import { Upload, Film, X, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  taskId: string;
  currentUrl?: string;
  onUploaded: (signedUrl: string) => void;
  onDeleted?: () => void;
}


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://coblfehkclfjofrshlwl.supabase.co';
const MAX_MB = 500;

const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

export default function VideoUploader({ taskId, currentUrl, onUploaded, onDeleted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const hasVideo = !!currentUrl && currentUrl.includes('task-videos');

  const extractStoragePath = (url: string) => {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const bucketIdx = parts.findIndex(p => p === 'task-videos');
      if (bucketIdx === -1 || bucketIdx + 1 >= parts.length) return null;
      return parts.slice(bucketIdx + 1).join('/');
    } catch {
      return null;
    }
  };

  const doUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de vídeo (MP4, MOV, WebM).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Vídeo excede ${MAX_MB}MB. Reduza a resolução (ex: 1080p ou 720p) antes de subir.`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setUploading(true);
    setProgress(0);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/task-videos/${path}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
          ? resolve()
          : reject(new Error(`Falha no upload (${xhr.status}): ${xhr.responseText}`));
        xhr.onerror = () => reject(new Error('Erro de rede no upload.'));
        xhr.onabort = () => reject(new Error('Upload cancelado.'));
        xhr.send(file);
      });

      const { data: signed, error: sErr } = await supabase.storage
        .from('task-videos')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed?.signedUrl) throw sErr || new Error('Não foi possível gerar link.');

      const url = signed.signedUrl;
      const { error: updErr } = await supabase.from('tasks').update({ video_url: url }).eq('id', taskId);
      if (updErr) throw updErr;

      onUploaded(url);
      toast.success('Vídeo enviado e pronto para o cliente!');
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao enviar vídeo.');
    } finally {
      setUploading(false);
      xhrRef.current = null;
    }
  }, [taskId, onUploaded]);

  const deleteVideo = async () => {
    if (!currentUrl) return;
    const path = extractStoragePath(currentUrl);
    setDeleting(true);
    try {
      if (path) {
        const { error: storageErr } = await supabase.storage.from('task-videos').remove([path]);
        if (storageErr) console.warn('Erro ao remover arquivo do storage:', storageErr);
      }
      const { error: updErr } = await supabase.from('tasks').update({ video_url: null }).eq('id', taskId);
      if (updErr) throw updErr;
      onUploaded('');
      onDeleted?.();
      toast.success('Vídeo removido.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao remover vídeo.');
    } finally {
      setDeleting(false);
    }
  };

  const cancel = () => {
    xhrRef.current?.abort();
  };


  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) doUpload(f);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-all',
          dragOver ? 'border-primary bg-primary/10' : 'border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10',
          uploading && 'cursor-wait'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doUpload(f);
            e.target.value = '';
          }}
        />

        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[11px] font-semibold text-foreground mb-1">
                <span className="truncate max-w-[70%]">{fileName}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-primary/20 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{fmtSize(fileSize)} · enviando...</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); cancel(); }}
            >
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </>
        ) : hasVideo ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-semibold text-foreground">Vídeo enviado ✓</p>
            <p className="text-[11px] text-muted-foreground">
              Arraste um novo arquivo ou clique para substituir
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); deleteVideo(); }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {deleting ? 'Removendo...' : 'Excluir vídeo'}
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Arraste o vídeo aqui ou <span className="text-primary underline">clique para escolher</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                MP4 (H.264) até {MAX_MB}MB · O cliente assiste direto na página, sem baixar
              </p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-md bg-muted/30 border border-border p-2.5 text-[10.5px] text-muted-foreground leading-relaxed">
        <p className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
          <Film className="h-3 w-3 text-primary" /> Para reprodução mais leve
        </p>
        Exporte em <b>MP4 H.264</b>, resolução <b>1080p ou 720p</b>, bitrate ~4–6 Mbps.
        Reels/Stories verticais podem sair em 720×1280. O player usa <i>streaming por partes</i>,
        então o cliente já começa a assistir sem baixar o arquivo inteiro.
      </div>
    </div>
  );
}
