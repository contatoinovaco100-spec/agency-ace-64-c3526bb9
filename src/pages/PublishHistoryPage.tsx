import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Film } from 'lucide-react';
import { TargetStatusList } from '@/components/social/TargetStatusList';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import type { JobStatus } from '@/types/social';

const jobBadge: Record<JobStatus, { label: string; cls: string }> = {
  pending: { label: 'Na fila', cls: 'bg-muted text-muted-foreground' },
  processing: { label: 'Publicando', cls: 'bg-primary/15 text-primary' },
  published: { label: 'Publicado', cls: 'bg-emerald-500/15 text-emerald-500' },
  partial: { label: 'Parcial', cls: 'bg-amber-500/15 text-amber-500' },
  failed: { label: 'Falhou', cls: 'bg-destructive/15 text-destructive' },
  scheduled: { label: 'Agendado', cls: 'bg-sky-500/15 text-sky-400' },
};

export default function PublishHistoryPage() {
  const { jobs, targetsOf, loading } = usePublishJobs();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Publicações</h1>
        <p className="text-sm text-muted-foreground">Todas as publicações e o resultado por conta.</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma publicação ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const targets = targetsOf(job.id);
            const badge = jobBadge[job.status] ?? jobBadge.pending;
            return (
              <Collapsible
                key={job.id}
                open={open === job.id}
                onOpenChange={o => setOpen(o ? job.id : null)}
              >
                <Card className="transition-colors hover:border-primary/40">
                  <CollapsibleTrigger className="w-full text-left">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                        {job.thumbnail_url
                          ? <img src={job.thumbnail_url} alt="" className="h-full w-full rounded-md object-cover" />
                          : <Film className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{job.caption || 'Sem legenda'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(job.created_at).toLocaleString('pt-BR')} · {targets.length} conta(s)
                        </p>
                      </div>
                      <Badge className={badge.cls} variant="secondary">{badge.label}</Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open === job.id ? 'rotate-180' : ''}`} />
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="border-t border-border pt-3">
                      <TargetStatusList targets={targets} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
