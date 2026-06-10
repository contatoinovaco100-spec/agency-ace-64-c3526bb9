import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Palette, Calendar, User, Building2, AlertCircle, RefreshCw, X, Clock, FileText, Flag } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';

interface ArteTask {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  priority: string | null;
  due_date: string | null;
  status: string;
  client_id: string | null;
  client_name: string | null;
  post_date: string | null;
  post_time: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  'A fazer': 'bg-muted text-muted-foreground border-border',
  'Em andamento': 'bg-primary/10 text-primary border-primary/30',
  'Revisão': 'bg-warning/10 text-warning border-warning/30',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Alta': 'bg-destructive/10 text-destructive border-destructive/30',
  'Média': 'bg-warning/10 text-warning border-warning/30',
  'Baixa': 'bg-success/10 text-success-foreground border-success/30',
};

const PRIORITY_ACCENT: Record<string, string> = {
  'Alta': 'border-l-destructive',
  'Média': 'border-l-warning',
  'Baixa': 'border-l-success',
};

function formatDate(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

export default function PublicArtesPage() {
  const [tasks, setTasks] = useState<ArteTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArteTask | null>(null);

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    const { data, error } = await (supabase as any).rpc('get_public_arte_tasks');
    if (error) setError(error.message);
    else { setTasks(data || []); setError(null); }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(false), 10000);
    const channel = (supabase as any)
      .channel('public-artes-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load(false))
      .subscribe();
    return () => {
      clearInterval(interval);
      (supabase as any).removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const grouped: Record<string, ArteTask[]> = { 'A fazer': [], 'Em andamento': [], 'Revisão': [] };
  tasks.forEach(t => {
    const key = grouped[t.status] ? t.status : 'A fazer';
    grouped[key].push(t);
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoInova} alt="INOVA" className="h-9 w-auto" />
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                <Palette className="h-5 w-5 text-primary" />
                Painel de Artes
              </h1>
              <p className="text-xs text-muted-foreground">Lista de artes estáticas pendentes — atualiza automaticamente</p>
            </div>
          </div>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <AlertCircle className="mb-2 h-5 w-5" />
            <p className="font-medium">Erro ao carregar artes</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Palette className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold">Nenhuma arte pendente</p>
            <p className="text-sm text-muted-foreground">Tudo em dia! Conforme novas artes forem criadas, aparecem aqui.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Total pendentes" value={tasks.length} />
              <StatCard label="Prioridade alta" value={tasks.filter(t => t.priority === 'Alta').length} highlight />
              <StatCard label="Em revisão" value={grouped['Revisão'].length} />
            </div>

            {(['A fazer', 'Em andamento', 'Revisão'] as const).map(status => (
              grouped[status].length > 0 && (
                <section key={status}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    <span className={`inline-flex h-2 w-2 rounded-full ${
                      status === 'A fazer' ? 'bg-muted-foreground' :
                      status === 'Em andamento' ? 'bg-primary' : 'bg-warning'
                    }`} />
                    {status}
                    <span className="text-xs font-medium text-muted-foreground/70">({grouped[status].length})</span>
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[status].map(t => <TaskCard key={t.id} task={t} onOpen={() => setSelected(t)} />)}
                  </div>
                </section>
              )
            ))}
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-border bg-card py-6 text-center text-xs text-muted-foreground">
        INOVA Co. — Painel interno de produção
      </footer>

      {selected && <TaskDetailModal task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-card'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: ArteTask; onOpen: () => void }) {
  const due = formatDate(task.post_date || task.due_date);
  const isLate = (task.post_date || task.due_date) && new Date((task.post_date || task.due_date)!) < new Date(new Date().toDateString());
  const accent = PRIORITY_ACCENT[task.priority || ''] || 'border-l-border';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex flex-col gap-3 rounded-xl border border-border border-l-4 ${accent} bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
          {task.title || 'Sem título'}
        </h3>
        {task.priority && (
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[task.priority] || 'bg-muted text-muted-foreground border-border'}`}>
            {task.priority}
          </span>
        )}
      </div>

      {task.description && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {task.client_name && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1">
            <Building2 className="h-3 w-3" /> {task.client_name}
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1">
            <User className="h-3 w-3" /> {task.assignee}
          </span>
        )}
        {due && (
          <span className={`inline-flex items-center gap-1 rounded px-2 py-1 ${isLate ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
            <Calendar className="h-3 w-3" /> {due}{task.post_time ? ` ${task.post_time.slice(0,5)}` : ''}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[task.status] || 'bg-muted text-muted-foreground border-border'}`}>
          {task.status}
        </span>
        <span className="text-[10px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
          Ver detalhes →
        </span>
      </div>
    </button>
  );
}

function TaskDetailModal({ task, onClose }: { task: ArteTask; onClose: () => void }) {
  const due = formatDate(task.post_date || task.due_date);
  const created = formatDate(task.created_at);
  const accent = PRIORITY_ACCENT[task.priority || ''] || 'border-l-border';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-t-2xl border border-border border-l-4 ${accent} bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-muted p-1.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border bg-gradient-to-br from-secondary to-card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[task.status] || 'bg-muted text-muted-foreground border-border'}`}>
              {task.status}
            </span>
            {task.priority && (
              <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[task.priority] || 'bg-muted text-muted-foreground border-border'}`}>
                <Flag className="mr-1 inline h-3 w-3" />{task.priority}
              </span>
            )}
          </div>
          <h2 className="pr-8 text-xl font-bold leading-tight text-foreground">
            {task.title || 'Sem título'}
          </h2>
          {task.client_name && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-primary">
              <Building2 className="h-3.5 w-3.5" /> {task.client_name}
            </p>
          )}
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          {task.description && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Briefing
              </h3>
              <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm leading-relaxed text-foreground">
                {task.description}
              </p>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            {task.assignee && (
              <InfoRow icon={<User className="h-4 w-4" />} label="Responsável" value={task.assignee} />
            )}
            {due && (
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label={task.post_date ? 'Data de postagem' : 'Entrega'}
                value={`${due}${task.post_time ? ` · ${task.post_time.slice(0, 5)}` : ''}`}
              />
            )}
            {created && (
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Criada em" value={created} />
            )}
          </section>
        </div>

        <div className="border-t border-border bg-secondary px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
