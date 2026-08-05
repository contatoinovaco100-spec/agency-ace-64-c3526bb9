import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Palette, Calendar, User, Building2, AlertCircle, RefreshCw, X, Clock, FileText, Flag, ZoomIn, Download, Image as ImageIcon } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';
import { prepareImageAttachments, signPreparedAttachments, type AttachmentRow, type PreparedAttachment } from '@/lib/arteAttachments';

// ─── Types ──────────────────────────────────────────────────────────────────
const useArteAttachments = (taskId: string) => {
  const [items, setItems] = useState<PreparedAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_public_arte_attachments', { _task_id: taskId });
      if (error) { setLoading(false); return; }
      
      const rows = (data || []) as AttachmentRow[];

      // Nunca confiar na URL gravada (pode ser pública antiga em bucket privado
      // ou assinada expirada): extrai o caminho e re-assina com URL nova.
      const { prepared, pathsToSign } = prepareImageAttachments(rows);
      const signed = await signPreparedAttachments(prepared, pathsToSign);

      if (!cancelled) { setItems(signed); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [taskId]);
  return { items, loading };
};

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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

      {selected && <TaskDetailModal task={selected} onClose={() => setSelected(null)} onOpenLightbox={setLightboxUrl} />}

      {/* Fullscreen Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/25 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Arte"
            className="max-h-screen max-w-screen-xl w-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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

function TaskCardPreview({ taskId }: { taskId: string }) {
  const { items, loading } = useArteAttachments(taskId);
  const preview = items.find(i => i.isImage && i.signedUrl);
  if (loading) return <div className="h-20 animate-pulse rounded-md bg-muted" />;
  if (!preview) return null;
  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-muted">
      <img
        src={preview.signedUrl}
        alt={preview.name}
        className="h-24 w-full object-cover"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        onLoad={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.parentElement?.querySelector('.animate-pulse')?.classList.add('hidden');
        }}
        style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
        <ZoomIn className="h-5 w-5 text-white opacity-0 transition group-hover:opacity-100" />
      </div>
      {items.length > 1 && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
          +{items.length - 1}
        </span>
      )}
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

      {/* Art preview thumbnail */}
      <TaskCardPreview taskId={task.id} />

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
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

function ModalArteGallery({ taskId, onOpenLightbox }: { taskId: string; onOpenLightbox: (url: string) => void }) {
  const { items, loading } = useArteAttachments(taskId);
  const images = items.filter(i => i.isImage && i.signedUrl);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (item: PreparedAttachment, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(item.id);
    try {
      const fetchUrl = item.signedUrl || item.path;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error('Falha no download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = item.name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally { setDownloading(null); }
  };

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (!images.length && !items.length) return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-muted-foreground">
      <ImageIcon className="h-8 w-8" />
      <p className="text-sm">Nenhuma arte anexada ainda</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => onOpenLightbox(img.signedUrl!)}
            className="group relative overflow-hidden rounded-xl border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            title="Clique para ampliar"
          >
            <img
              src={img.signedUrl}
              alt={img.name}
              className="w-full object-cover transition group-hover:scale-[1.02]"
              style={{ maxHeight: images.length > 1 ? '180px' : '360px' }}
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all group-hover:bg-black/40">
              <ZoomIn className="h-7 w-7 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
            </div>
            <button
              type="button"
              onClick={(e) => handleDownload(img, e)}
              disabled={downloading === img.id}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/85 disabled:opacity-50"
            >
              {downloading === img.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Baixar
            </button>
          </button>
        ))}
      </div>
      {/* Non-image attachments */}
      {items.filter(i => !i.isImage).map(item => (
        <button
          key={item.id}
          type="button"
          onClick={(e) => handleDownload(item, e as any)}
          disabled={downloading === item.id}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground hover:bg-muted/70 disabled:opacity-60"
        >
          {downloading === item.id ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Download className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{item.name}</span>
        </button>
      ))}
    </div>
  );
}

function TaskDetailModal({ task, onClose, onOpenLightbox }: { task: ArteTask; onClose: () => void; onOpenLightbox: (url: string) => void }) {
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
          {/* Art preview — click to open fullscreen */}
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3.5 w-3.5" /> Arte
              <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground/60">— clique para ampliar</span>
            </h3>
            <ModalArteGallery taskId={task.id} onOpenLightbox={onOpenLightbox} />
          </section>

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
