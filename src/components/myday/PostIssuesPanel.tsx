import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { ISSUES, scoreByOwner, type FlaggedPost, type IssueKind } from '@/lib/postIssues';
import { cn } from '@/lib/utils';

const taskLink = (t: FlaggedPost['task']) => `${t.taskType === 'Arte' ? '/artes' : '/tarefas'}?taskId=${t.id}`;
const taskName = (t: FlaggedPost['task']) => (t.videoName || t.title || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');

const tagTone = (k: IssueKind) => ISSUES[k].severity === 3 ? 'bg-destructive/10 text-destructive'
  : ISSUES[k].severity === 2 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';

function PostRow({ p, clientName }: { p: FlaggedPost; clientName: Record<string, string> }) {
  return (
    <li>
      <Link to={taskLink(p.task)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{taskName(p.task)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {(p.task.clientId && clientName[p.task.clientId]) || 'Sem cliente'} · posta {shortDate(p.task.postDate!)}{p.task.postTime ? ` às ${p.task.postTime.slice(0, 5)}` : ''} · {p.task.status}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.issues.map((i) => (
              <span key={i.kind} className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', tagTone(i.kind))}>
                {ISSUES[i.kind].label}{i.detail ? `: ${i.detail}` : ''}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/**
 * Erros nos posts. Admin vê a pontuação de cada social media (grave 3, médio 2, leve 1) e abre os posts de cada um;
 * os outros veem só os posts dos clientes deles.
 */
export function PostIssuesPanel({ posts, clientName, isAdmin, me }: {
  posts: FlaggedPost[]; clientName: Record<string, string>; isAdmin: boolean; me: string;
}) {
  const ranking = useMemo(() => scoreByOwner(posts), [posts]);
  const [openOwner, setOpenOwner] = useState<string | null>(null);
  const mine = useMemo(() => posts.filter((p) => p.owner.toLowerCase() === me.toLowerCase()), [posts, me]);
  const list = isAdmin ? posts : mine;
  if (!list.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-l-[3px] border-l-destructive bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-muted-foreground" /> Erros nos posts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {list.length === 1 ? '1 post com problema' : `${list.length} posts com problema`} entre os últimos 30 dias e os próximos 14.
          {isAdmin && ' Pontos: grave 3, médio 2, leve 1. O responsável é o do cadastro do cliente.'}
        </p>
      </div>

      {isAdmin ? (
        <ul className="divide-y">
          {ranking.map((r) => {
            const open = openOwner === r.owner;
            return (
              <li key={r.owner}>
                <button type="button" onClick={() => setOpenOwner(open ? null : r.owner)} aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.owner}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(Object.entries(r.kinds) as [IssueKind, number][])
                        .sort((a, b) => ISSUES[b[0]].severity - ISSUES[a[0]].severity || b[1] - a[1])
                        .map(([k, n]) => (
                          <span key={k} className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', tagTone(k))}>{n} {ISSUES[k].label.toLowerCase()}</span>
                        ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-semibold tabular-nums text-foreground">{r.points}</p>
                    <p className="text-[11px] text-muted-foreground">{r.posts.length === 1 ? '1 post' : `${r.posts.length} posts`}</p>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <ul className="divide-y border-t bg-muted/30">
                    {r.posts.map((p) => <PostRow key={p.task.id} p={p} clientName={clientName} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y">{mine.slice(0, 12).map((p) => <PostRow key={p.task.id} p={p} clientName={clientName} />)}</ul>
      )}
    </section>
  );
}
