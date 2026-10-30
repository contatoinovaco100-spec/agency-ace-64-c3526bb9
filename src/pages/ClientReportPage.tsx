import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ChevronRight, Film, Image as ImageIcon, Loader2, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchClientReviews, type ClientReview } from '@/lib/clientApprovals';
import { resolveVideoUrl } from '@/lib/videoUrl';
import { useSeo } from '@/lib/seo';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';

/**
 * Relatório mensal público do cliente (/relatorio/:clientId?mes=AAAA-MM).
 * Mostra o que foi entregue no mês, o que o cliente aprovou e o que vem no mês seguinte,
 * usando os mesmos dados públicos da página de aprovação (/conteudo).
 */
type Task = {
  id: string; title: string; video_name: string; task_type: string | null; status: string;
  post_date: string | null; post_time?: string | null; format: string; platform: string; video_url?: string | null;
};
type Attachment = { file_url: string; file_type: string };

const DONE = /postado|publicado|conclu/i;
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const isArte = (t: Task) => t.task_type === 'Arte';
const titleOf = (t: Task) => ((isArte(t) ? t.title : t.video_name || t.title) || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (key: string, n: number) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); const n = MONTHS[m - 1]; return `${n[0].toUpperCase()}${n.slice(1)} de ${y}`; };
// Nos primeiros dias do mês o relatório padrão é o do mês que acabou
const defaultMonth = () => { const now = new Date(); return now.getDate() <= 10 ? shiftMonth(monthKey(now), -1) : monthKey(now); };

export default function ClientReportPage() {
  useSeo({ title: 'Relatório mensal — INOVA Co.', description: 'O que a INOVA entregou para a sua marca no mês.', noindex: true });
  const { clientId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : defaultMonth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [clientName, setClientName] = useState('');
  const [reviews, setReviews] = useState<Record<string, ClientReview>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // Links assinados dos vídeos vencem: renova antes de mostrar
  const [videoSrc, setVideoSrc] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc('get_public_client_tasks', { _anchor: clientId });
      const list = ((data ?? []) as Task[]);
      setTasks(list);
      if (list[0]) {
        const { data: name } = await (supabase as any).rpc('get_public_client_name', { _id: (list[0] as unknown as { client_id: string }).client_id });
        if (name) setClientName(name as string);
      }
      setReviews(await fetchClientReviews(list.map((t) => t.id)));
    })();
  }, [clientId]);

  const data = useMemo(() => {
    if (!tasks) return null;
    const inMonth = (t: Task, key: string) => (t.post_date ?? '').slice(0, 7) === key;
    const delivered = tasks.filter((t) => inMonth(t, month) && DONE.test(t.status))
      .sort((a, b) => (a.post_date ?? '').localeCompare(b.post_date ?? ''));
    const next = tasks.filter((t) => inMonth(t, shiftMonth(month, 1)) && !/^ideia|backlog/i.test(t.status))
      .sort((a, b) => (a.post_date ?? '').localeCompare(b.post_date ?? ''));
    const approved = tasks.filter((t) => reviews[t.id]?.approved && reviews[t.id]?.at?.slice(0, 7) === month).length;
    return {
      delivered, next, approved,
      videos: delivered.filter((t) => !isArte(t)).length,
      artes: delivered.filter(isArte).length,
    };
  }, [tasks, month, reviews]);

  // Miniatura das artes entregues
  useEffect(() => {
    if (!data) return;
    data.delivered.filter((t) => !isArte(t) && t.video_url && !videoSrc[t.id]).slice(0, 24).forEach(async (t) => {
      const url = await resolveVideoUrl(t.video_url!).catch(() => t.video_url!);
      setVideoSrc((m) => ({ ...m, [t.id]: url }));
    });
    data.delivered.filter(isArte).filter((t) => !thumbs[t.id]).slice(0, 24).forEach(async (t) => {
      const { data: att } = await (supabase as any).rpc('get_public_arte_attachments', { _task_id: t.id });
      const img = ((att ?? []) as Attachment[]).find((a) => /^image\//.test(a.file_type) || /\.(png|jpe?g|webp)(\?|$)/i.test(a.file_url));
      if (img) setThumbs((m) => ({ ...m, [t.id]: img.file_url }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.delivered.length]);

  const go = (n: number) => setParams((p) => { p.set('mes', shiftMonth(month, n)); return p; }, { replace: true });

  if (!tasks) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!tasks.length) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <img src={logoInova} alt="INOVA Co." className="h-10 brightness-0 dark:brightness-100" />
      <p className="font-display text-xl font-semibold">Relatório não encontrado</p>
      <p className="text-sm text-muted-foreground">Confira o link ou fale com a equipe da INOVA.</p>
    </div>
  );

  const d = data!;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <img src={logoInova} alt="INOVA Co." className="h-8 brightness-0 dark:brightness-100" />
          <Link to={`/conteudo/${clientId}`} className="text-sm font-medium text-primary hover:underline">Aprovar conteúdos</Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8">
        <header className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Relatório mensal</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{clientName || 'Sua marca'}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[160px] text-center text-sm font-medium">{monthLabel(month)}</span>
            <button onClick={() => go(1)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>

        {/* O número que importa: quanto foi entregue */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 rounded-xl border bg-card p-5 sm:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Entregues</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{d.delivered.length}</p>
            <p className="text-xs text-muted-foreground">conteúdos no ar</p>
          </div>
          <Mini label="Vídeos" value={d.videos} />
          <Mini label="Artes" value={d.artes} />
          <Mini label="Aprovados por você" value={d.approved} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">O que foi ao ar</h2>
          {d.delivered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum conteúdo marcado como publicado neste mês.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.delivered.map((t) => (
                <li key={t.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="dark relative flex aspect-[4/5] items-center justify-center bg-black">
                    {thumbs[t.id] ? <img src={thumbs[t.id]} alt="" loading="lazy" crossOrigin="anonymous" className="h-full w-full object-cover" />
                      : videoSrc[t.id] && /\.(mp4|mov|webm)(\?|$)|supabase\.co\/storage/i.test(videoSrc[t.id])
                        ? <video src={`${videoSrc[t.id]}#t=0.5`} muted preload="metadata" crossOrigin="anonymous" className="h-full w-full object-cover" />
                        : isArte(t) ? <ImageIcon className="h-7 w-7 text-white/50" /> : <Film className="h-7 w-7 text-white/50" />}
                    {!isArte(t) && t.video_url && (
                      <a href={videoSrc[t.id] ?? t.video_url} target="_blank" rel="noopener noreferrer" aria-label="Assistir"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/40 hover:opacity-100">
                        <Play className="h-8 w-8" />
                      </a>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{titleOf(t)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.post_date ? new Date(t.post_date.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : ''}
                      {t.format ? ` · ${t.format}` : isArte(t) ? ' · Arte' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Vem aí em {MONTHS[Number(shiftMonth(month, 1).slice(5)) - 1]}
          </h2>
          {d.next.length === 0 ? (
            <p className="text-sm text-muted-foreground">O planejamento do próximo mês ainda está sendo montado.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {d.next.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', isArte(t) ? 'bg-warning' : 'bg-primary')} />
                  <span className="min-w-0 flex-1 truncate text-sm">{titleOf(t)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t.post_date ? new Date(t.post_date.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                  </span>
                </li>
              ))}
              {d.next.length > 12 && <li className="px-4 py-3 text-xs text-muted-foreground">e mais {d.next.length - 12}</li>}
            </ul>
          )}
        </section>

        <p className="pt-4 text-center text-xs text-muted-foreground">Produzido pela equipe INOVA Co.</p>
      </main>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
