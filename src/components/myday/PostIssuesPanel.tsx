import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Loader2, MessageCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ISSUES, issuesMessage, scoreByOwner, type FlaggedPost, type IssueKind } from '@/lib/postIssues';
import { cn } from '@/lib/utils';

const taskLink = (t: FlaggedPost['task']) => `${t.taskType === 'Arte' ? '/artes' : '/tarefas'}?taskId=${t.id}`;
const taskName = (t: FlaggedPost['task']) => (t.videoName || t.title || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');

const phoneOf = (raw?: string | null) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
};
const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

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
  // WhatsApp de cada pessoa (Equipe → Funcionários), para mandar a lista de erros
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState<{ owner: string; to: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles').select('full_name, whatsapp').then(({ data }) => setPhones(Object.fromEntries(
      ((data ?? []) as { full_name: string | null; whatsapp: string | null }[])
        .filter((p) => p.full_name).map((p) => [p.full_name!.trim().toLowerCase(), phoneOf(p.whatsapp)]))));
  }, [isAdmin]);

  const openSend = (owner: string, ownerPosts: FlaggedPost[]) => {
    const to = phones[owner.toLowerCase()];
    if (!to) { toast.error(`${owner} está sem WhatsApp`, { description: 'Preencha o WhatsApp em Equipe → Funcionários.' }); return; }
    setSending({ owner, to, text: issuesMessage(owner, ownerPosts, clientName, window.location.origin) });
  };
  const send = async () => {
    if (!sending) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('wa-server', { body: { action: 'send', to: sending.to, message: sending.text } });
    setBusy(false);
    if (error || data?.error) { toast.error('Mensagem não enviada', { description: data?.error ?? 'Confira se o WhatsApp está conectado em Automações.' }); return; }
    toast.success(`Erros enviados para ${sending.owner} no WhatsApp`);
    setSending(null);
  };

  if (!list.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-l-[3px] border-l-destructive bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-muted-foreground" /> Erros nos posts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {list.length === 1 ? '1 post com problema' : `${list.length} posts com problema`} que ainda vão sair (próximos 30 dias).
          {isAdmin && ' Pontos: grave 3, médio 2, leve 1. Social media é quem tem "social" no cargo em Equipe → Funcionários.'}
        </p>
      </div>

      {isAdmin ? (
        <ul className="divide-y">
          {ranking.map((r) => {
            const open = openOwner === r.owner;
            return (
              <li key={r.owner}>
                <div className="flex items-center gap-1 pr-3 transition-colors hover:bg-foreground/[0.03]">
                <button type="button" onClick={() => setOpenOwner(open ? null : r.owner)} aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
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
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => openSend(r.owner, r.posts)}
                  title={phones[r.owner.toLowerCase()] ? `Mandar os erros para ${r.owner} no WhatsApp` : 'Sem WhatsApp em Equipe → Funcionários'}>
                  <MessageCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Enviar</span>
                </Button>
                </div>
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

      <Dialog open={!!sending} onOpenChange={(v) => { if (!v && !busy) setSending(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar erros para {sending?.owner}</DialogTitle>
            <DialogDescription>WhatsApp {sending ? fmtPhone(sending.to) : ''}. Dá para editar o texto antes de enviar.</DialogDescription>
          </DialogHeader>
          <Textarea value={sending?.text ?? ''} onChange={(e) => sending && setSending({ ...sending, text: e.target.value })} className="min-h-[320px] text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSending(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={send} disabled={busy || !sending?.text.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
