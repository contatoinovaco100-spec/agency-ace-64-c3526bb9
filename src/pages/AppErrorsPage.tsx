import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/notificationFeed';
import { cn } from '@/lib/utils';

type AppError = {
  id: string; created_at: string; user_email: string | null; kind: string;
  message: string; stack: string | null; path: string | null; user_agent: string | null; release: string | null;
};

const KIND_LABEL: Record<string, string> = {
  render: 'Tela quebrou', error: 'Erro de script', promise: 'Falha sem tratamento', chunk: 'Versão antiga em cache',
};

const PERIODS = [1, 7, 30] as const;

/** Erros registrados automaticamente nos navegadores da equipe e dos clientes, agrupados pela mensagem */
export default function AppErrorsPage() {
  const [rows, setRows] = useState<AppError[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_errors' as never)
      .select('id, created_at, user_email, kind, message, stack, path, user_agent, release')
      .gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString())
      .order('created_at', { ascending: false }).limit(1000);
    setMissing(!!error && /app_errors/.test(error.message));
    setRows(error ? [] : (data ?? []) as unknown as AppError[]);
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, AppError[]>();
    rows.forEach((r) => {
      const key = `${r.kind}|${r.message}`;
      const list = map.get(key);
      if (list) list.push(r); else map.set(key, [r]);
    });
    return [...map.entries()]
      .map(([key, list]) => ({
        key, list, latest: list[0],
        people: new Set(list.map((r) => r.user_email ?? 'visitante')).size,
        paths: [...new Set(list.map((r) => (r.path ?? '').split('?')[0]))].slice(0, 4),
      }))
      .sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
  }, [rows]);

  const remove = async (ids: string[]) => {
    const { error } = await supabase.from('app_errors' as never).delete().in('id', ids);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.filter((x) => !ids.includes(x.id)));
    toast.success('Marcado como resolvido.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Erros da plataforma"
        description="Registrados sozinhos quando alguma tela falha no navegador de alguém. Resolveu? Marque e ele sai da lista."
        actions={<>
          <div className="flex rounded-md border border-border p-0.5">
            {PERIODS.map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', days === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                {d === 1 ? '24h' : `${d} dias`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={load} aria-label="Atualizar"><RotateCw className="h-4 w-4" /></Button>
        </>}
      />

      {missing ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          A tabela de erros ainda não existe no banco. Publique a atualização no Lovable (Publish → Update) para aplicar a migração.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <Bug className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-display font-semibold">Nenhum erro no período</p>
          <p className="mt-1 text-sm text-muted-foreground">Quando algo falhar, aparece aqui e no sino de notificações.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {groups.map((g) => {
              const open = openKey === g.key;
              return (
                <li key={g.key}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button onClick={() => setOpenKey(open ? null : g.key)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {KIND_LABEL[g.latest.kind] ?? g.latest.kind}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
                      </span>
                      <span className="mt-0.5 block break-words font-mono text-[13px] text-foreground">{g.latest.message}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {g.paths.join(', ')} · {g.people} {g.people === 1 ? 'pessoa' : 'pessoas'} · último há {timeAgo(new Date(g.latest.created_at).getTime())}
                      </span>
                    </button>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', g.list.length > 5 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-foreground')}>
                      {g.list.length}×
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => remove(g.list.map((r) => r.id))} className="shrink-0 text-muted-foreground">
                      <Trash2 className="h-4 w-4" /> Resolvido
                    </Button>
                  </div>
                  {open && (
                    <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3 text-xs">
                      <p className="whitespace-pre-line text-muted-foreground">
                        {g.list.slice(0, 5).map((r) => `${new Date(r.created_at).toLocaleString('pt-BR')} · ${r.user_email ?? 'visitante'} · ${r.path}`).join('\n')}
                      </p>
                      {g.latest.release && <p className="text-muted-foreground">Versão publicada em {g.latest.release.replace('T', ' ')}</p>}
                      {g.latest.stack && (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-[11px] text-muted-foreground">{g.latest.stack}</pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
