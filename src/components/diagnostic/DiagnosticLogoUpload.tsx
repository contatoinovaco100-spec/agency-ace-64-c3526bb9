import { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function DiagnosticLogoUpload({ value, onChange, disabled = false }: {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 10MB).');
      return;
    }
    setUploading(true);
    try {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `diagnostics/logos/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('task-attachments').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Logo enviada.');
    } catch {
      toast.error('Não foi possível enviar a logo. Tente novamente.');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-2 text-left">
      <p className="text-sm font-semibold text-foreground">Logo do cliente (opcional)</p>
      <div className="flex items-center gap-3">
        {value && <img src={value} crossOrigin="anonymous" alt="Logo do cliente" className="h-16 w-16 shrink-0 rounded-md border border-border bg-background object-contain p-1" />}
        <Button variant="outline" disabled={disabled || uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? 'Enviando…' : value ? 'Trocar logo' : 'Enviar logo'}
        </Button>
        {value && <Button variant="ghost" size="icon" aria-label="Remover logo" disabled={disabled || uploading} onClick={() => onChange('')}><X className="h-4 w-4" /></Button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Arquivo da logo do cliente" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
    </div>
  );
}