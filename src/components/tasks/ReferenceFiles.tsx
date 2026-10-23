import { useRef, useState } from 'react';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/lib/arteAttachments';
import type { TaskAttachment } from '@/types/agency';
import { toast } from 'sonner';

interface Props {
  taskId?: string;
  files: TaskAttachment[];
  onAdded: (files: TaskAttachment[]) => void;
  onRemoved: (id: string) => void;
}

export default function ReferenceFiles({ taskId, files, onAdded, onRemoved }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!taskId || !selected.length || uploading) return;
    setUploading(true);
    const added: TaskAttachment[] = [];
    try {
      for (const file of selected) {
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'arquivo';
        const path = `${taskId}/references/${crypto.randomUUID()}-${safeName}`;
        try {
          const { error } = await supabase.storage.from('task-attachments').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
          if (error) throw error;
          const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
          const attachment: TaskAttachment = { id: crypto.randomUUID(), taskId, fileName: file.name, fileUrl: data.publicUrl, fileType: file.type || 'application/octet-stream', createdAt: new Date().toISOString() };
          const { error: saveError } = await supabase.from('task_attachments').insert({ id: attachment.id, task_id: taskId, file_name: file.name, file_url: attachment.fileUrl, file_type: attachment.fileType });
          if (saveError) {
            await supabase.storage.from('task-attachments').remove([path]);
            throw saveError;
          }
          added.push(attachment);
        } catch (error) {
          toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Não foi possível enviar o arquivo'}`);
        }
      }
      if (added.length) {
        onAdded(added);
        toast.success(`${added.length} arquivo(s) de referência enviado(s)`);
      }
    } finally { setUploading(false); }
  };

  const download = async (file: TaskAttachment) => {
    const path = extractStoragePath(file.fileUrl);
    if (!path) return;
    setBusyId(file.id);
    try {
      const { data, error } = await supabase.storage.from('task-attachments').download(path);
      if (error || !data) throw error || new Error('Arquivo indisponível');
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { toast.error('Não foi possível baixar a referência'); }
    finally { setBusyId(null); }
  };

  const remove = async (file: TaskAttachment) => {
    setBusyId(file.id);
    try {
      const { error } = await supabase.from('task_attachments').delete().eq('id', file.id);
      if (error) throw error;
      onRemoved(file.id);
      const path = extractStoragePath(file.fileUrl);
      if (path) await supabase.storage.from('task-attachments').remove([path]);
    } catch { toast.error('Não foi possível excluir a referência'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold text-foreground">Arquivos de referência ({files.length})</h3>
      {files.map(file => (
        <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-md bg-secondary/30 px-2 py-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-all text-sm">{file.fileName}</span>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={`Baixar referência: ${file.fileName}`} aria-label={`Baixar referência: ${file.fileName}`} disabled={busyId === file.id} onClick={() => download(file)}><Download className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" title={`Excluir referência: ${file.fileName}`} aria-label={`Excluir referência: ${file.fileName}`} disabled={busyId === file.id || uploading} onClick={() => remove(file)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {!files.length && <p className="text-xs text-muted-foreground">Nenhum arquivo de referência.</p>}
      <input ref={input} type="file" multiple className="hidden" aria-label="Arquivos de referência" onChange={upload} disabled={uploading || !taskId} />
      <Button type="button" variant="outline" className="w-full gap-2" disabled={uploading || !taskId} onClick={() => input.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Enviando referências...' : 'Subir arquivos de referência'}
      </Button>
      {!taskId && <p className="text-xs text-muted-foreground">Salve o card para anexar referências.</p>}
    </div>
  );
}