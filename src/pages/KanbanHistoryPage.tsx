import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAgency } from '@/contexts/AgencyContext';
import {
  clearHistory,
  getHistory,
  routeForEntry,
  subscribeHistory,
  type TaskMoveHistoryEntry,
} from '@/lib/taskMoveHistory';
import { cn } from '@/lib/utils';

function formatDateHeader(d: Date) {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Hoje';
  if (same(d, yest)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function timeHM(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function KanbanHistoryPage() {
  const { user } = useAuth();
  const { clients } = useAgency();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => subscribeHistory(() => setTick(t => t + 1)), []);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach(c => m.set(c.id, c.companyName || 'Sem cliente'));
    return m;
  }, [clients]);

  const entries: TaskMoveHistoryEntry[] = useMemo(
    () => (user ? getHistory(user.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, tick],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e => {
      const client = e.clientId ? (clientNameById.get(e.clientId) || '').toLowerCase() : '';
      return (
        e.title.toLowerCase().includes(q) ||
        client.includes(q) ||
        (e.toStatus || '').toLowerCase().includes(q)
      );
    });
  }, [entries, search, clientNameById]);

  // Group: date -> client -> entries[]
  const grouped = useMemo(() => {
    const byDate = new Map<string, Map<string, TaskMoveHistoryEntry[]>>();
    for (const e of filtered) {
      const d = new Date(e.at);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const clientKey = e.clientId ? (clientNameById.get(e.clientId) || 'Sem cliente') : 'Sem cliente';
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const cm = byDate.get(dateKey)!;
      if (!cm.has(clientKey)) cm.set(clientKey, []);
      cm.get(clientKey)!.push(e);
    }
    return Array.from(byDate.entries()).map(([dateKey, cm]) => ({
      dateKey,
      date: new Date(dateKey + 'T00:00:00'),
      clients: Array.from(cm.entries())
        .map(([name, items]) => ({ name, items }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }));
  }, [filtered, clientNameById]);

  if (!user) {
    return <div className="p-6 text-muted-foreground">Faça login para ver seu histórico.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> Histórico do Kanban
            </h1>
            <p className="text-xs text-muted-foreground">
              Movimentações registradas na sua sessão, agrupadas por data e cliente.
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Limpar todo o histórico?')) clearHistory(user.id);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar por título, cliente ou coluna..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-6"
      />

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Nenhuma movimentação registrada ainda.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(g => (
            <section key={g.dateKey}>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 first-letter:uppercase">
                {formatDateHeader(g.date)}
              </h2>
              <div className="space-y-4">
                {g.clients.map(c => (
                  <div key={c.name} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/40">
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.items.length} {c.items.length === 1 ? 'movimentação' : 'movimentações'}
                      </span>
                    </div>
                    <ul className="divide-y divide-border">
                      {c.items.map(e => (
                        <li key={e.id}>
                          <button
                            onClick={() => navigate(routeForEntry(e))}
                            className={cn(
                              'w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-center gap-3',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{e.title}</div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="truncate">{e.fromStatus || '—'}</span>
                                <ArrowRight className="h-3 w-3 shrink-0" />
                                <span className="truncate text-foreground font-medium">{e.toStatus}</span>
                                {e.taskType && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                                    {e.taskType}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {timeHM(e.at)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
