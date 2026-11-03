import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Cargos sugeridos. "Social Media" no cargo é o que coloca a pessoa nos Erros nos posts do Meu dia. */
const SUGGESTIONS = ['Social Media', 'Editor de vídeo', 'Designer', 'Copywriter', 'Videomaker', 'Gestor de tráfego', 'Comercial', 'Head de marketing'];

/** Cargo do funcionário, editável na lista de Funcionários. Salva ao sair do campo. */
export function EmployeeJobTitle({ profileId, value: initial, onSaved }: { profileId: string; value: string; onSaved?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  useEffect(() => { setValue(initial); setSaved(initial); }, [initial]);

  const save = async () => {
    const v = value.trim();
    if (v === saved) return;
    // Sem permissão o banco não dá erro, só não altera nada: confere se a linha voltou
    const { data, error } = await supabase.from('profiles').update({ job_title: v || null }).eq('id', profileId).select('id');
    if (error || !data?.length) {
      toast.error('Não foi possível salvar o cargo', { description: error?.message ?? 'Falta aplicar a migração 20261103110000_admin_update_profiles no Lovable.' });
      setValue(saved); return;
    }
    setSaved(v);
    onSaved?.(v);
    toast.success('Cargo salvo');
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Briefcase className="h-3.5 w-3.5 shrink-0" />
      <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="Cargo" list="employee-job-titles" aria-label="Cargo"
        className="h-7 w-40 rounded-md border bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}

/** Lista de sugestões do campo de cargo (uma vez na página) */
export function JobTitleSuggestions({ extra = [] }: { extra?: string[] }) {
  const all = [...new Set([...SUGGESTIONS, ...extra.filter(Boolean)])];
  return <datalist id="employee-job-titles">{all.map((t) => <option key={t} value={t} />)}</datalist>;
}
