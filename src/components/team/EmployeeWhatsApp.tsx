import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * WhatsApp do funcionário, usado pelas Automações para mandar lembretes para cada pessoa
 * (tarefa nova, prazo, lead parado…). Salva ao sair do campo. Some enquanto a coluna não existe no banco.
 */
export function EmployeeWhatsApp({ profileId }: { profileId: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('whatsapp' as never).eq('id', profileId).maybeSingle()
      .then(({ data, error }) => {
        setAvailable(!error);
        const v = ((data as unknown as { whatsapp: string | null } | null)?.whatsapp) ?? '';
        setValue(v); setSaved(v);
      });
  }, [profileId]);

  const save = async () => {
    const v = value.trim();
    if (v === saved) return;
    if (v && v.replace(/\D/g, '').length < 10) { toast.error('WhatsApp com DDD, ex.: 24 99999-9999'); return; }
    const { error } = await supabase.from('profiles').update({ whatsapp: v || null } as never).eq('id', profileId);
    if (error) { toast.error('Não foi possível salvar o WhatsApp'); return; }
    setSaved(v);
    toast.success('WhatsApp salvo');
  };

  if (!available) return null;
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
      <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="WhatsApp" inputMode="tel"
        className="h-7 w-36 rounded-md border bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}
