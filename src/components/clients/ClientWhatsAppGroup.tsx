import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Loader2, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Group = { id: string; name: string };

/**
 * Grupo do WhatsApp do cliente: escolhido da lista de grupos do número conectado no servidor QR Code.
 * Os lembretes de aprovação vão para este grupo; sem grupo, vão para o telefone do cadastro.
 */
export function ClientWhatsAppGroup({ clientId }: { clientId: string }) {
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  // false enquanto a coluna não existe no banco (migração ainda não aplicada)
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('clients').select('whatsapp_group_id, whatsapp_group_name' as never).eq('id', clientId).maybeSingle()
      .then(({ data, error }) => {
        setAvailable(!error);
        const row = data as unknown as { whatsapp_group_id: string | null; whatsapp_group_name: string | null } | null;
        setCurrent(row?.whatsapp_group_id ? { id: row.whatsapp_group_id, name: row.whatsapp_group_name || 'Grupo' } : null);
      });
  }, [clientId]);

  const loadGroups = async () => {
    if (groups || loadingGroups) return;
    setLoadingGroups(true);
    const { data, error } = await supabase.functions.invoke('wa-server', { body: { action: 'groups' } });
    setLoadingGroups(false);
    if (error || data?.error) {
      toast.error('Não foi possível listar os grupos', { description: data?.error || 'Confira se o WhatsApp está conectado.' });
      setOpen(false);
      return;
    }
    setGroups((data?.groups ?? []) as Group[]);
  };

  const save = async (g: Group | null) => {
    const { error } = await supabase.from('clients')
      .update({ whatsapp_group_id: g?.id ?? null, whatsapp_group_name: g?.name ?? null } as never).eq('id', clientId);
    if (error) { toast.error('Não foi possível salvar o grupo'); return; }
    setCurrent(g);
    setOpen(false);
    toast.success(g ? `Grupo "${g.name}" vinculado` : 'Grupo removido');
  };

  if (!available) return null;
  const filtered = (groups ?? []).filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <p className="text-caption text-muted-foreground">Grupo do WhatsApp</p>
      <div className="mt-1 flex items-center gap-2">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) loadGroups(); }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-full justify-between gap-2">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{current ? current.name : 'Escolher grupo'}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-0">
            <div className="border-b p-2">
              <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar grupo" />
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {loadingGroups && <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
              {groups && filtered.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum grupo encontrado.</p>}
              {filtered.map((g) => (
                <button key={g.id} onClick={() => save(g)}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted">
                  <Check className={`h-3.5 w-3.5 shrink-0 ${current?.id === g.id ? 'text-primary' : 'text-transparent'}`} />
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {current && (
          <button onClick={() => save(null)} aria-label="Remover grupo"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Atalhos para copiar os links públicos do cliente (aprovação de conteúdo e relatório do mês) */
export function ClientPublicLinks({ clientId }: { clientId: string }) {
  const copy = async (path: string, label: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); toast.success(`Link ${label} copiado`); }
    catch { toast.error('Não foi possível copiar'); }
  };
  return (
    <div>
      <p className="text-caption text-muted-foreground">Links do cliente</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => copy(`/portal/${clientId}`, 'do portal')}>Portal</Button>
        <Button variant="outline" size="sm" onClick={() => copy(`/conteudo/${clientId}`, 'de aprovação')}>Aprovação</Button>
        <Button variant="outline" size="sm" onClick={() => copy(`/relatorio/${clientId}`, 'do relatório')}>Relatório do mês</Button>
      </div>
    </div>
  );
}
