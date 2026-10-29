import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CalendarCheck, Check, Film, Loader2, Search, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { publishingService, type PostType } from '@/services/publishing';
import { socialAccountsService } from '@/services/socialAccounts';
import { PLATFORM_META, type SocialAccount } from '@/types/social';
import { cn } from '@/lib/utils';

export type ScheduleMedia = { url: string; kind: 'video' | 'image'; name: string };

interface Props {
  clientId: string | null;
  clientName: string;
  media: ScheduleMedia[];
  caption: string;
  /** "AAAA-MM-DD" e "HH:mm" vindos do painel (o que está nos campos, salvo ou não) */
  date: string;
  time: string;
  captionLimit: number;
  /** O post já está na etapa Programado: provavelmente já foi agendado antes */
  alreadyScheduled?: boolean;
  /** Chamado depois de agendar (com o id da publicação): o painel salva legenda/data/horário no post */
  onScheduled: (jobId: string) => Promise<void> | void;
  /** Abre já com o formulário de agendamento aberto (vindo da fila de aprovados) */
  defaultOpen?: boolean;
}

const MIN_LEAD_MINUTES = 10;

/** Baixa a mídia já anexada ao post para reenviar ao serviço de publicação (que exige arquivo). */
async function urlToFile(url: string, fallbackName: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível baixar ${fallbackName}`);
  const blob = await res.blob();
  const fromUrl = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
  const name = fromUrl.includes('.') ? fromUrl : fallbackName;
  const type = blob.type || (/\.(mp4|mov|webm|m4v)$/i.test(name) ? 'video/mp4' : 'image/jpeg');
  return new File([blob], name, { type });
}

const accountUsable = (a: SocialAccount) => !!a.external_id && a.status !== 'expired' && a.token_status !== 'expired';

const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Palavras de segmento ("barbearia", "lanchonete"…) aparecem em vários clientes e confundem a sugestão
const GENERIC = new Set(['ltda', 'eireli', 'oficial', 'the', 'store', 'stores', 'studio', 'clinica', 'instituto', 'loja',
  'restaurante', 'lanchonete', 'lanches', 'barbearia', 'pizzaria', 'hamburgueria', 'gourmet', 'confeitaria', 'odontologia',
  'veterinaria', 'estetica', 'imoveis', 'moveis', 'automoveis', 'planejados', 'imports', 'roupas', 'acessorios', 'servicos']);

/** Quanto o @ de uma conta parece ser do cliente (0 = não parece). As contas ainda não têm cliente vinculado. */
function matchScore(a: SocialAccount, clientName: string) {
  const handle = normalize(`${a.username} ${a.display_name}`);
  const full = normalize(clientName);
  if (full.length >= 5 && handle.includes(full)) return 100;
  const words = clientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  const compact = words.join('');
  if (compact.length >= 6 && handle.includes(compact)) return 90;
  if (compact.length >= 4 && normalize(a.username).startsWith(compact)) return 80;
  const hits = words.filter((w) => w.length >= 4 && handle.includes(w));
  const strong = hits.some((w) => w.length >= 6) || hits.length >= 2;
  return strong ? hits.reduce((n, w) => n + w.length, 0) : 0;
}

export function SchedulePostSection({ clientId, clientName, media, caption, date, time, captionLimit, alreadyScheduled, onScheduled, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen && media.length > 0);
  const sectionRef = useRef<HTMLElement>(null);
  // Vindo da fila de aprovados: rola o painel até o agendamento
  useEffect(() => {
    if (defaultOpen && media.length) setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [postType, setPostType] = useState<PostType>('auto');
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');

  // Contas vinculadas ao cliente (ou, sem vínculo, as que parecem ser dele) já vêm marcadas
  useEffect(() => {
    if (!open || accounts) return;
    socialAccountsService.list()
      .then((all) => {
        const usable = all.filter((a) => a.platform !== 'tiktok');
        setAccounts(usable);
        const linked = usable.filter((a) => clientId && a.client_id === clientId);
        // Sem vínculo: marca só a conta mais parecida com o nome do cliente
        const scored = usable.filter((a) => !a.client_id).map((a) => ({ a, score: matchScore(a, clientName) })).filter((x) => x.score > 0);
        const best = Math.max(0, ...scored.map((x) => x.score));
        const guess = linked.length ? linked : scored.filter((x) => x.score === best).map((x) => x.a);
        setSelectedAccounts(guess.filter(accountUsable).map((a) => a.id));
      })
      .catch(() => { setAccounts([]); toast.error('Não foi possível carregar as contas conectadas'); });
  }, [open, accounts, clientId, clientName]);

  // Lista mostrada: as do cliente/sugeridas e as marcadas; com busca, procura em todas
  const shownAccounts = useMemo(() => {
    if (!accounts) return [];
    const q = normalize(accountSearch);
    if (q) return accounts.filter((a) => normalize(`${a.username} ${a.display_name}`).includes(q)).slice(0, 8);
    return accounts.filter((a) => selectedAccounts.includes(a.id) || (clientId && a.client_id === clientId) || (!a.client_id && matchScore(a, clientName) > 0));
  }, [accounts, accountSearch, selectedAccounts, clientId, clientName]);

  // Mídia padrão: o vídeo (Reels) ou todas as imagens (post único ou carrossel)
  useEffect(() => {
    const video = media.find((m) => m.kind === 'video');
    setSelectedMedia(video ? [video.url] : media.filter((m) => m.kind === 'image').slice(0, 10).map((m) => m.url));
    setDone(null);
  }, [media]);

  const chosenMedia = media.filter((m) => selectedMedia.includes(m.url));
  const chosenAccounts = (accounts ?? []).filter((a) => selectedAccounts.includes(a.id));
  // Horário de Brasília, igual ao que o serviço de publicação grava (toScheduledIso)
  const when = useMemo(() => (date && time ? new Date(`${date}T${time}:00-03:00`) : null), [date, time]);

  // O que impede de agendar, na ordem em que a pessoa resolveria
  const blocker = useMemo(() => {
    if (!chosenMedia.length) return 'Escolha a mídia do post.';
    if (chosenMedia.some((m) => m.kind === 'video') && chosenMedia.length > 1) return 'Vídeo vai sozinho: desmarque as outras mídias.';
    // "-" e "." são marcadores vazios do Kanban: não contam como legenda
    if (!/[\p{L}\p{N}]{2,}/u.test(caption) && postType !== 'stories') return 'Escreva a legenda acima.';
    if (caption.length > captionLimit) return `A legenda passou de ${captionLimit} caracteres.`;
    if (!when) return 'Defina data e horário em Publicação, acima.';
    if (when.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) return `Escolha um horário com pelo menos ${MIN_LEAD_MINUTES} minutos de antecedência.`;
    if (!chosenAccounts.length) return 'Marque ao menos uma conta.';
    if (chosenAccounts.some((a) => !accountUsable(a))) return 'Há conta vencida ou manual marcada: reconecte em Redes Sociais ou desmarque.';
    return null;
  }, [chosenMedia, caption, captionLimit, postType, when, chosenAccounts]);

  const whenLabel = when?.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const schedule = async () => {
    if (blocker || !when) return;
    setProgress(2);
    try {
      const files: File[] = [];
      for (const [i, m] of chosenMedia.entries()) {
        files.push(await urlToFile(m.url, m.kind === 'video' ? `video-${i + 1}.mp4` : `arte-${i + 1}.jpg`));
        setProgress(2 + Math.round(((i + 1) / chosenMedia.length) * 8));
      }
      const job = await publishingService.createJob({
        files,
        caption,
        scheduledAt: `${date}T${time}`,
        postType,
        accounts: chosenAccounts,
        onProgress: (p) => setProgress(Math.max(10, p)),
      });
      // Vincula ao cliente as contas usadas que ainda não tinham dono, para virem marcadas da próxima vez
      const toLink = chosenAccounts.filter((a) => !a.client_id).map((a) => a.id);
      if (clientId && toLink.length) {
        await supabase.from('social_accounts' as never).update({ client_id: clientId } as never).in('id', toLink);
      }
      await onScheduled(job.id);
      setDone(whenLabel ?? '');
      toast.success('Publicação agendada', { description: `${chosenAccounts.map((a) => `@${a.username}`).join(', ')} · ${whenLabel}` });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error('Não foi possível agendar', {
        description: /fetch|baixar/i.test(message)
          ? 'A mídia está num link externo que não deu para baixar. Use Publicar Conteúdo com o arquivo.'
          : message,
      });
    } finally {
      setProgress(null);
    }
  };

  if (!open) {
    return (
      <Button className="w-full gap-2" onClick={() => setOpen(true)} disabled={!media.length}
        title={media.length ? undefined : 'Anexe a mídia ao post para poder agendar'}>
        <Send className="h-4 w-4" /> {media.length ? 'Agendar publicação' : 'Agendar publicação (sem mídia)'}
      </Button>
    );
  }

  return (
    <section ref={sectionRef} className="scroll-mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
          <Send className="h-3.5 w-3.5" /> Agendar publicação
        </h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(false)} disabled={progress !== null}>Fechar</Button>
      </div>

      {done ? (
        <div className="space-y-2 rounded-lg bg-card p-3 text-sm card-shadow">
          <p className="flex items-center gap-2 font-medium"><CalendarCheck className="h-4 w-4 text-success" /> Agendado para {done}</p>
          <p className="text-xs text-muted-foreground">A publicação sai sozinha no horário. Acompanhe ou cancele na fila de Publicar Conteúdo.</p>
          <Button asChild size="sm" variant="outline"><Link to="/publicar">Ver fila de publicação</Link></Button>
        </div>
      ) : (
        <>
          {/* Mídia */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Mídia {chosenMedia.length > 1 && <span className="text-muted-foreground">· carrossel com {chosenMedia.length}</span>}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {media.map((m) => {
                const on = selectedMedia.includes(m.url);
                return (
                  <button key={m.url} type="button" aria-pressed={on} aria-label={`${on ? 'Remover' : 'Usar'} ${m.name}`}
                    onClick={() => setSelectedMedia((s) => on ? s.filter((u) => u !== m.url) : [...s, m.url])}
                    className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-background transition', on ? 'ring-2 ring-primary' : 'opacity-50 hover:opacity-80')}>
                    {m.kind === 'image'
                      ? <img src={m.url} alt="" crossOrigin="anonymous" loading="lazy" className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center bg-muted"><Film className="h-5 w-5" /></span>}
                    {on && <span className="absolute right-0.5 top-0.5 rounded-full bg-brand p-0.5 text-brand-foreground"><Check className="h-2.5 w-2.5" /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formato */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {([['auto', 'Feed / Reels'], ['stories', 'Stories']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPostType(v)}
                className={cn('h-8 flex-1 rounded-md text-xs font-medium transition-colors', postType === v ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>

          {/* Contas */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Publicar em</p>
            {accounts !== null && accounts.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Buscar outra conta pelo @" className="h-9 pl-8 text-sm" />
              </div>
            )}
            {accounts === null ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando contas…</p>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma conta conectada. <Link to="/redes-sociais" className="font-medium text-primary underline-offset-2 hover:underline">Conectar em Redes Sociais</Link>
              </p>
            ) : shownAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {accountSearch ? 'Nenhuma conta com esse @.' : 'Não achamos a conta deste cliente automaticamente: busque pelo @ acima.'}
              </p>
            ) : shownAccounts.map((a) => {
              const usable = accountUsable(a);
              return (
                <label key={a.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-card p-2 text-sm card-shadow">
                  <Checkbox checked={selectedAccounts.includes(a.id)}
                    onCheckedChange={(c) => setSelectedAccounts((s) => c ? [...s, a.id] : s.filter((x) => x !== a.id))} />
                  {a.profile_picture
                    ? <img src={a.profile_picture} alt="" crossOrigin="anonymous" className="h-6 w-6 rounded-full object-cover" />
                    : <span className="h-6 w-6 rounded-full bg-muted" />}
                  <span className="min-w-0 flex-1 truncate">@{a.username}</span>
                  <span className={cn('text-[11px]', usable ? PLATFORM_META[a.platform].color : 'text-warning')}>
                    {usable ? PLATFORM_META[a.platform].label : a.external_id ? 'Reconectar' : 'Manual'}
                  </span>
                </label>
              );
            })}
          </div>

          {blocker ? (
            <p className="flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {blocker}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Vai sair <span className="font-medium text-foreground">{whenLabel}</span> (horário de Brasília) em {chosenAccounts.map((a) => `@${a.username}`).join(', ')}, com a legenda acima.
            </p>
          )}

          {alreadyScheduled && (
            <p className="flex items-start gap-1.5 rounded-md bg-warning/10 p-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Este post já está como Programado. Confira a <Link to="/publicar" className="font-medium underline underline-offset-2">fila de publicação</Link> para não agendar duas vezes.</span>
            </p>
          )}
          {progress !== null && <Progress value={progress} className="h-1.5" />}
          <Button className="w-full gap-2" disabled={!!blocker || progress !== null} onClick={schedule}>
            {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            {progress !== null ? 'Enviando mídia…' : 'Confirmar agendamento'}
          </Button>
        </>
      )}
    </section>
  );
}
