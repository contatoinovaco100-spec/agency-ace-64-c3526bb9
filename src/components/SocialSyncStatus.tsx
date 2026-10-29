import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Execução da atualização automática das Redes Sociais (função social-daily-sync, todo dia às 00:00) */
type SyncRun = { id: string; status: 'ok' | 'warning' | 'error'; message: string; added: number; updated: number; created_at: string };

// Tabela nova: ainda fora dos tipos gerados do Supabase
const TABLE = 'social_sync_runs' as never;
/** Sem execução há mais que isso, o cron provavelmente parou */
const STALE_HOURS = 30;

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function useSocialSyncRuns() {
  const [last, setLast] = useState<SyncRun | null>(null);
  // false enquanto a tabela não existe no banco (migração ainda não aplicada)
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(1);
    setAvailable(!error);
    setLast(((data ?? []) as unknown as SyncRun[])[0] ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { last, available, reload: load };
}

/** Aviso no Dashboard (admins): a última atualização deu erro ou o agendamento parou de rodar */
export function SocialSyncAlert() {
  const { last } = useSocialSyncRuns();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem('social-sync:dismissed'); } catch { return null; }
  });
  if (!last) return null;

  const stale = Date.now() - new Date(last.created_at).getTime() > STALE_HOURS * 3_600_000;
  if (last.status !== 'error' && !stale) return null;
  // Dispensar vale só para esta execução: um erro novo volta a aparecer
  const key = `${last.id}:${stale ? 'stale' : 'error'}`;
  if (dismissed === key) return null;

  const dismiss = () => {
    try { localStorage.setItem('social-sync:dismissed', key); } catch { /* sem storage */ }
    setDismissed(key);
  };

  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-xl border p-4',
      stale && last.status !== 'error' ? 'border-warning/40 bg-warning/10' : 'border-destructive/40 bg-destructive/10')}>
      <AlertTriangle className={cn('mt-0.5 h-5 w-5 shrink-0', stale && last.status !== 'error' ? 'text-warning' : 'text-destructive')} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">
          {last.status === 'error' ? 'A atualização automática das Redes Sociais falhou' : 'A atualização automática das Redes Sociais parou de rodar'}
        </p>
        <p className="text-sm text-foreground/80 [text-wrap:pretty]">
          {last.status === 'error' ? last.message : `A última execução foi em ${when(last.created_at)}. Confira o agendamento no Lovable.`}
        </p>
        {last.status === 'error' && <p className="text-xs text-muted-foreground">Em {when(last.created_at)}</p>}
        <Button asChild size="sm" variant="outline" className="mt-2">
          <Link to="/redes-sociais">Abrir Redes Sociais</Link>
        </Button>
      </div>
      <button onClick={dismiss} aria-label="Dispensar aviso"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Linha de status na página Redes Sociais, com botão para rodar a atualização na hora */
export function SocialSyncLine({ onDone }: { onDone?: () => void }) {
  const { last, available, reload } = useSocialSyncRuns();
  const [running, setRunning] = useState(false);
  if (!available) return null;

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily-sync', { body: {} });
      if (data?.skipped) toast.info(data.reason);
      else if (error || data?.status === 'error') toast.error('A atualização falhou', { description: data?.message || error?.message });
      else toast.success('Redes sociais atualizadas', { description: data?.message });
    } catch (e) {
      toast.error('A atualização falhou', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
      reload(); onDone?.();
    }
  };

  const tone = !last ? 'muted' : last.status === 'error' ? 'destructive' : last.status === 'warning' ? 'warning' : 'success';
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm sm:flex-row sm:items-center">
      {tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        : <AlertTriangle className={cn('h-4 w-4 shrink-0', tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground')} />}
      <p className="min-w-0 flex-1 text-foreground/80 [text-wrap:pretty]">
        <span className="font-medium text-foreground">Atualização automática todo dia às 00:00.</span>{' '}
        {last ? <>Última em {when(last.created_at)}: {last.message}</> : 'Ainda não rodou nenhuma vez.'}
      </p>
      <Button size="sm" variant="outline" onClick={runNow} disabled={running} className="shrink-0 gap-1.5">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Rodar agora
      </Button>
    </div>
  );
}
