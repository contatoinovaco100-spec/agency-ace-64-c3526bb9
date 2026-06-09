import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Palette, Calendar, User, Building2, AlertCircle, RefreshCw } from 'lucide-react';
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
  'A fazer': 'bg-slate-100 text-slate-700 border-slate-300',
  'Em andamento': 'bg-blue-100 text-blue-700 border-blue-300',
  'Revisão': 'bg-amber-100 text-amber-700 border-amber-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Alta': 'bg-red-100 text-red-700 border-red-300',
  'Média': 'bg-amber-100 text-amber-700 border-amber-300',
  'Baixa': 'bg-emerald-100 text-emerald-700 border-emerald-300',
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
    const interval = setInterval(() => load(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Group by status
  const grouped: Record<string, ArteTask[]> = { 'A fazer': [], 'Em andamento': [], 'Revisão': [] };
  tasks.forEach(t => {
    const key = grouped[t.status] ? t.status : 'A fazer';
    grouped[key].push(t);
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoInova} alt="INOVA" className="h-9 w-auto" />
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                <Palette className="h-5 w-5 text-fuchsia-600" />
                Painel de Artes
              </h1>
              <p className="text-xs text-slate-500">Lista de artes estáticas pendentes — atualiza automaticamente</p>
            </div>
          </div>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            <AlertCircle className="mb-2 h-5 w-5" />
            <p className="font-medium">Erro ao carregar artes</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <Palette className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="text-lg font-semibold text-slate-700">Nenhuma arte pendente</p>
            <p className="text-sm text-slate-500">Tudo em dia! Conforme novas artes forem criadas, aparecem aqui.</p>
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
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                    <span className={`inline-flex h-2 w-2 rounded-full ${
                      status === 'A fazer' ? 'bg-slate-400' :
                      status === 'Em andamento' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {status}
                    <span className="text-xs font-medium text-slate-400">({grouped[status].length})</span>
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[status].map(t => <TaskCard key={t.id} task={t} />)}
                  </div>
                </section>
              )
            ))}
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        INOVA Co. — Painel interno de produção
      </footer>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function TaskCard({ task }: { task: ArteTask }) {
  const due = formatDate(task.post_date || task.due_date);
  const isLate = (task.post_date || task.due_date) && new Date((task.post_date || task.due_date)!) < new Date(new Date().toDateString());

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-slate-900">{task.title || 'Sem título'}</h3>
        {task.priority && (
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[task.priority] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
            {task.priority}
          </span>
        )}
      </div>

      {task.description && (
        <p className="line-clamp-3 text-xs text-slate-600">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
        {task.client_name && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
            <Building2 className="h-3 w-3" /> {task.client_name}
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
            <User className="h-3 w-3" /> {task.assignee}
          </span>
        )}
        {due && (
          <span className={`inline-flex items-center gap-1 rounded px-2 py-1 ${isLate ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
            <Calendar className="h-3 w-3" /> {due}{task.post_time ? ` ${task.post_time.slice(0,5)}` : ''}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2">
        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
          {task.status}
        </span>
      </div>
    </article>
  );
}
