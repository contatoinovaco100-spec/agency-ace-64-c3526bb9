import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { publishingService } from '@/services/publishing';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Trash2, LayoutGrid, List } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PublishJob, PublishTarget } from '@/types/social';

function JobThumb({ job }: { job: PublishJob }) {
  const [src, setSrc] = useState<string | null>(
    job.thumbnail_url || job.media_url || null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!src && job.media_path) {
      publishingService.mediaUrl(job.media_path).then(url => {
        if (!cancelled && url) setSrc(url);
      });
    }
    return () => { cancelled = true; };
  }, [src, job.media_path]);

  if (!src) {
    return <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />;
  }
  if (/\.(mp4|mov|webm|m4v)/i.test(src) || job.media_type === 'video') {
    return <video src={src} className="h-16 w-16 shrink-0 rounded-md object-cover" muted />;
  }
  return <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />;
}

interface PlannedPost {
  job: PublishJob;
  targets: PublishTarget[];
  dateKey: string;
}

export function PublishedPlannerTab() {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'list'>('month');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, t] = await Promise.all([
        publishingService.listJobs(200),
        publishingService.listTargets(),
      ]);
      setJobs(j);
      setTargets(t);
    } catch (e: any) {
      console.error('Error loading published posts:', e);
      toast.error('Erro ao carregar publicações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (jobId: string) => {
    if (!confirm('Excluir este post da plataforma? (o post no Instagram não é afetado)')) return;
    setDeletingId(jobId);
    try {
      await publishingService.deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setTargets(prev => prev.filter(t => t.job_id !== jobId));
      toast.success('Post excluído da plataforma');
    } catch (e: any) {
      toast.error('Erro ao excluir', { description: e?.message });
    } finally {
      setDeletingId(null);
    }
  };

  const posts = useMemo<PlannedPost[]>(() => {
    const published = jobs.filter(j => j.status === 'published' || j.status === 'partial');
    return published.map(job => {
      const jobTargets = targets.filter(t => t.job_id === job.id);
      const done = jobTargets.filter(t => t.status === 'published' && t.published_at).map(t => t.published_at);
      const publishedAt = done.sort()[0] || job.scheduled_at || job.created_at;
      const dateKey = publishedAt ? format(new Date(publishedAt), 'yyyy-MM-dd') : '';
      return { job, targets: jobTargets, dateKey };
    });
  }, [jobs, targets]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const postsByDay = useMemo(() => {
    const map: Record<string, PlannedPost[]> = {};
    for (const p of posts) {
      if (!p.dateKey) continue;
      if (!map[p.dateKey]) map[p.dateKey] = [];
      map[p.dateKey].push(p);
    }
    return map;
  }, [posts]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPublished = posts.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Planner de Publicações</h2>
          <p className="text-sm text-muted-foreground">
            {totalPublished} post(s) publicados — clique na lixeira para remover da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border p-0.5">
            <Button size="sm" variant={view === 'month' ? 'secondary' : 'ghost'} className="h-7" onClick={() => setView('month')}>
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Mês
            </Button>
            <Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} className="h-7" onClick={() => setView('list')}>
              <List className="h-3.5 w-3.5 mr-1" /> Lista
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum post publicado ainda.
          </CardContent>
        </Card>
      ) : view === 'month' ? (
        <Card className="border-white/5 bg-black/20 backdrop-blur-sm">
          <CardContent className="p-0 sm:p-4 pt-0">
            <div className="flex items-center justify-center py-4">
              <span className="text-lg font-bold capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-px sm:gap-1 mb-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px sm:gap-1 bg-white/5 rounded-lg overflow-hidden border border-white/5">
              {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayPosts = postsByDay[dateKey] ?? [];
                const isCurrentMonth = isSameMonth(day, monthStart);

                return (
                  <div
                    key={day.toString()}
                    className={`min-h-[110px] sm:min-h-[130px] p-1 sm:p-2 bg-zinc-950 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className={`text-right text-xs mb-1 font-medium ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-[100px] sm:max-h-[120px] scrollbar-none">
                      {dayPosts.map(p => (
                        <div
                          key={p.job.id}
                          className="group flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 p-1 text-[10px] sm:text-xs"
                          title={p.job.caption?.trim() || 'Sem legenda'}
                        >
                          <JobThumb job={p.job} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-white font-medium">
                              {p.job.caption?.trim() || (p.job.media_type === 'video' ? 'Vídeo' : 'Imagem')}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {p.targets.length} conta(s)
                              {p.job.status === 'partial' && ' · parcial'}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(p.job.id)}
                            disabled={deletingId === p.job.id}
                            title="Excluir da plataforma"
                          >
                            {deletingId === p.job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...posts]
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
            .map(p => (
              <Card key={p.job.id} className="border-white/5 bg-black/20 backdrop-blur-sm">
                <CardContent className="flex items-center gap-3 p-3">
                  <JobThumb job={p.job} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.job.caption?.trim() || (p.job.media_type === 'video' ? 'Vídeo' : 'Imagem')}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
                        {format(new Date(p.dateKey), 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                      <Badge variant={p.job.status === 'partial' ? 'default' : 'secondary'} className={`text-[10px] h-4 px-1 py-0 ${p.job.status === 'partial' ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                        {p.job.status === 'partial' ? 'Parcial' : 'Publicado'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {p.targets.filter(t => t.status === 'published').length}/{p.targets.length} conta(s)
                      </span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(p.job.id)}
                    disabled={deletingId === p.job.id}
                    title="Excluir da plataforma"
                  >
                    {deletingId === p.job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
