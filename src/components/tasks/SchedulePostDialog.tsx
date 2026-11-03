import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, PartyPopper, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAgency } from '@/contexts/AgencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { commemorativeByDay } from '@/lib/commemorativeDates';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/agency';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const short = (s: string) => fromIso(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

type Field = 'due' | 'post';

/**
 * Planner que abre depois de criar o card: só marca as datas planejadas (entrega, dia e hora de postar).
 * Não agenda nem publica nada: o card continua no kanban e passa por captação, edição e revisão.
 * O calendário mostra os posts que o cliente já tem e as datas comemorativas.
 */
export function SchedulePostDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { tasks, clients, updateTask } = useAgency();
  const [month, setMonth] = useState(() => new Date());
  const [field, setField] = useState<Field>('due');
  const [due, setDue] = useState('');
  const [post, setPost] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setDue(task.dueDate || '');
    setPost(task.postDate || '');
    setTime(task.postTime?.slice(0, 5) || '');
    setField(task.dueDate && !task.postDate ? 'post' : 'due');
    setMonth(fromIso(task.postDate || task.dueDate || iso(new Date())));
  }, [task]);

  const clientName = clients.find((c) => c.id === task?.clientId)?.companyName;
  const today = iso(new Date());

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const from = iso(days[0]); const to = iso(days[41]);
  const holidays = useMemo(() => commemorativeByDay(from, to), [from, to]);
  // Posts que o cliente já tem marcados no mês, para não cair dois no mesmo dia
  const taken = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of tasks) {
      if (!task || t.id === task.id || t.deletedAt || t.clientId !== task.clientId || !t.postDate) continue;
      if (t.postDate < from || t.postDate > to) continue;
      (map[t.postDate] ??= []).push(t.videoName || t.title || 'Post');
    }
    return map;
  }, [tasks, task, from, to]);

  const pick = (day: string) => {
    if (field === 'due') {
      setDue(day);
      // Entrega depois do dia de postar não faz sentido: o dia de postar acompanha
      if (post && post < day) setPost('');
      setField('post');
    } else {
      setPost(day);
      if (due && due > day) setDue(day);
    }
  };

  const save = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await updateTask({ ...task, dueDate: due, postDate: post, postTime: post ? time : '' });
      toast.success('Datas do card salvas', { description: 'O card segue no kanban: captação, edição e revisão.' });
      onClose();
    } catch (e) {
      toast.error('Não foi possível salvar as datas', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const FieldButton = ({ k, label, value, Icon }: { k: Field; label: string; value: string; Icon: typeof Send }) => (
    <button type="button" onClick={() => setField(k)}
      className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg border p-2.5 text-left transition-colors',
        field === k ? 'border-primary bg-primary/10' : 'hover:border-foreground/30')}>
      <Icon className={cn('h-4 w-4 shrink-0', k === 'due' ? 'text-orange-500' : 'text-primary')} />
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn('block truncate text-sm font-semibold', !value && 'text-muted-foreground font-normal')}>{value ? short(value) : 'Escolher no calendário'}</span>
      </span>
    </button>
  );

  return (
    // Datas obrigatórias: só fecha salvando (sem X, Esc ou clique fora)
    <Dialog open={!!task}>
      {/* Presa no alto: o aviso muda a altura e o calendário não pode pular de lugar */}
      <DialogContent className="top-[4vh] max-h-[92vh] translate-y-0 overflow-y-auto sm:max-w-[460px] [&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Datas do card</DialogTitle>
          <DialogDescription className="truncate">
            {task?.videoName || task?.title || 'Card novo'}{clientName ? ` · ${clientName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <FieldButton k="due" label="Post pronto (entrega)" value={due} Icon={CalendarCheck} />
          <FieldButton k="post" label="Dia de postar" value={post} Icon={Send} />
        </div>

        <div className="rounded-lg border p-2">
          <div className="mb-1 flex items-center justify-between">
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mês anterior"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Próximo mês"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
            {DAYS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const key = iso(d);
              const out = d.getMonth() !== month.getMonth();
              const h = holidays[key];
              const posts = taken[key] ?? [];
              const isDue = key === due; const isPost = key === post;
              const past = key < today;
              const title = [h?.map((x) => x.name).join(' · '), posts.length ? `${posts.length} post(s) do cliente: ${posts.join(', ')}` : ''].filter(Boolean).join('\n');
              return (
                <button key={key} type="button" onClick={() => pick(key)} title={title || undefined}
                  className={cn('relative flex h-11 flex-col items-center justify-center rounded-md text-sm transition-colors',
                    out ? 'text-muted-foreground/50' : past ? 'text-muted-foreground' : 'text-foreground',
                    isPost ? 'bg-primary font-bold text-primary-foreground' : isDue ? 'bg-orange-500 font-bold text-white' : 'hover:bg-muted',
                    key === today && !isPost && !isDue && 'ring-1 ring-inset ring-primary/60')}>
                  {d.getDate()}
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {h && <span className={cn('h-1.5 w-1.5 rounded-full', h.some((x) => x.major) ? 'bg-fuchsia-500' : 'bg-muted-foreground/50')} />}
                    {posts.length > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', isPost ? 'bg-primary-foreground' : 'bg-sky-500')} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> já tem post do cliente</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" /> data comemorativa</span>
          </div>
        </div>

        {post && (holidays[post] || taken[post]?.length) ? (
          <div className="space-y-1 rounded-lg bg-muted/60 p-2.5 text-xs">
            {holidays[post] && <p className="flex items-center gap-1.5"><PartyPopper className="h-3.5 w-3.5 text-fuchsia-500" /> {holidays[post].map((x) => x.name).join(' · ')}</p>}
            {taken[post]?.length ? <p className="text-warning">Esse dia já tem {taken[post].length} post(s) deste cliente.</p> : null}
          </div>
        ) : null}

        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Horário de postar</span>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!post} className="h-9 w-32" />
        </label>

        {(!due || !post || !time) && (
          <p className="text-xs font-medium text-warning">
            Obrigatório: {[!due && 'entrega', !post && 'dia de postar', !time && 'horário de postar'].filter(Boolean).join(', ')}.
          </p>
        )}
        <p className="text-xs text-muted-foreground [text-wrap:pretty]">Só planeja as datas: nada é agendado nem publicado. O card segue no kanban por captação, edição e revisão.</p>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={save} disabled={saving || !due || !post || !time}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar datas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
