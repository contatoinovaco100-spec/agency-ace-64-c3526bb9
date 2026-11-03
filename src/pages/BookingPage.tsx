import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, CalendarX, ChevronLeft, ChevronRight, Clock, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/lib/seo';
import { cn } from '@/lib/utils';
import logoInova from '@/assets/logo-inova.png';

type Slot = { date: string; time: string };
type PageData = { client: string; location: string; slot_minutes: number; slots: Slot[]; booked: Slot[] };

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const longDate = (s: string) => {
  const t = fromIso(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const endTime = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
};

// A função ainda não está nos tipos gerados do Supabase
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

/** Página pública /agendar/:clientId: o cliente escolhe um horário livre e a captação entra na agenda de Gravações */
export default function BookingPage() {
  const { clientId = '' } = useParams();
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [month, setMonth] = useState<Date | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Slot | null>(null);

  useSeo({ title: 'Agendar captação — INOVA Co.', description: 'Escolha o melhor dia e horário para a sua captação com a INOVA.', noindex: true });

  const load = async () => {
    const { data: res, error: e } = await rpc('get_booking_page', { p_client: clientId });
    if (e || !res) { setState('invalid'); return; }
    const page = res as PageData;
    setData(page);
    setState('ready');
    setMonth((m) => m ?? (page.slots[0] ? fromIso(page.slots[0].date) : new Date()));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  const byDay = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of data?.slots ?? []) (map[s.date] ??= []).push(s.time);
    return map;
  }, [data]);

  const days = useMemo(() => {
    if (!month) return [];
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i));
  }, [month]);

  const book = async () => {
    if (!day || !time) return;
    setSaving(true); setError('');
    const { error: e } = await rpc('book_shooting', { p_client: clientId, p_date: day, p_time: time });
    setSaving(false);
    if (e) {
      setError(e.message.includes('não está mais livre') ? 'Esse horário acabou de ser ocupado. Escolha outro.' : 'Não foi possível marcar agora. Tente de novo.');
      setTime(null);
      load();
      return;
    }
    setDone({ date: day, time });
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex justify-center border-b px-4 py-5">
        <img src={logoInova} alt="INOVA Co." className="h-8 brightness-0 dark:brightness-100" />
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-8">{children}</main>
    </div>
  );

  if (state === 'loading') return shell(<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>);
  if (state === 'invalid' || !data) return shell(
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CalendarX className="h-10 w-10 text-muted-foreground" />
      <p className="font-semibold">Link de agendamento inválido</p>
      <p className="text-sm text-muted-foreground">Peça um link novo para a equipe da INOVA.</p>
    </div>,
  );

  if (done) return shell(
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"><CalendarCheck className="h-7 w-7" /></div>
      <h1 className="text-2xl font-bold">Captação marcada!</h1>
      <p className="text-muted-foreground [text-wrap:pretty]">
        <span className="font-semibold text-foreground">{longDate(done.date)}</span>, das {done.time} às {endTime(done.time, data.slot_minutes)}.
      </p>
      {data.location && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {data.location}</p>}
      <p className="text-sm text-muted-foreground">A equipe da INOVA já recebeu na agenda. Até lá!</p>
    </div>,
  );

  const today = iso(new Date());
  const times = day ? byDay[day] ?? [] : [];

  return shell(
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{data.client}</p>
        <h1 className="mt-1 text-2xl font-bold">Agende sua captação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o dia e o horário. Cada captação dura {data.slot_minutes >= 60 ? `${data.slot_minutes / 60}h`.replace('.', ',') : `${data.slot_minutes} min`}.
        </p>
        {data.location && <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {data.location}</p>}
      </div>

      {data.booked.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Você já tem captação marcada:</p>
          {data.booked.map((b) => <p key={b.date + b.time} className="text-muted-foreground">{longDate(b.date)}{b.time ? ` às ${b.time}` : ''}</p>)}
        </div>
      )}

      {data.slots.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No momento não há horários livres. Fale com a equipe da INOVA.</p>
      ) : month && (
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
            <Button size="icon" variant="ghost" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
            {DAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = iso(d);
              const free = !!byDay[key];
              const out = d.getMonth() !== month.getMonth();
              return (
                <button key={key} type="button" disabled={!free} onClick={() => { setDay(key); setTime(null); setError(''); }}
                  className={cn('h-11 rounded-lg text-sm transition-colors',
                    out && 'opacity-40',
                    day === key ? 'bg-primary font-bold text-primary-foreground'
                      : free ? 'bg-primary/10 font-semibold text-foreground hover:bg-primary/20'
                      : 'cursor-not-allowed text-muted-foreground/60',
                    key === today && day !== key && 'ring-1 ring-inset ring-primary/50')}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Os dias em destaque têm horário livre.</p>
        </div>
      )}

      {day && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{longDate(day)}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {times.map((t) => (
              <button key={t} type="button" onClick={() => { setTime(t); setError(''); }}
                className={cn('flex items-center justify-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors',
                  time === t ? 'border-primary bg-primary/10 text-foreground' : 'hover:border-primary/50')}>
                <Clock className="h-3.5 w-3.5" /> {t} – {endTime(t, data.slot_minutes)}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

      {day && (
        <Button className="h-12 w-full text-base" disabled={!time || saving} onClick={book}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {time ? `Confirmar ${fromIso(day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}` : 'Escolha um horário'}
        </Button>
      )}
    </div>,
  );
}
