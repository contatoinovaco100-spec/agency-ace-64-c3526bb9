import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Trash2, Link2, LogOut, RefreshCw, Loader2, Palette, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { supabase } from '@/integrations/supabase/client';

type EventType = 'reuniao' | 'gravacao' | 'entrega' | 'outro' | 'google';
interface CalEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: EventType;
  source?: 'local' | 'google' | 'shooting';
}

const DEFAULT_COLORS: Record<EventType, string> = {
  reuniao: '#3b82f6',
  gravacao: '#a855f7',
  entrega: '#bff720',
  outro: '#94a3b8',
  google: '#10b981',
};

const TYPE_LABELS: Record<EventType, string> = {
  reuniao: 'Reunião',
  gravacao: 'Gravação',
  entrega: 'Entrega',
  outro: 'Outro',
  google: 'Google',
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const LOCAL_EVENTS_KEY = 'calendar_local_events';
const COLORS_KEY = 'calendar_event_colors';

// Helper to build a colored chip style from a hex color
const chipStyle = (hex: string): React.CSSProperties => ({
  backgroundColor: `${hex}1A`, // ~10% alpha for a cleaner glass look
  color: hex,
  borderColor: `${hex}40`,
  borderWidth: 1,
  borderStyle: 'solid',
});

export default function CalendarPage() {
  const today = new Date();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate() });

  const [localEvents, setLocalEvents] = useState<CalEvent[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [colors, setColors] = useState<Record<EventType, string>>(() => {
    try {
      const raw = localStorage.getItem(COLORS_KEY);
      return raw ? { ...DEFAULT_COLORS, ...JSON.parse(raw) } : DEFAULT_COLORS;
    } catch { return DEFAULT_COLORS; }
  });

  const [shootings, setShootings] = useState<CalEvent[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [form, setForm] = useState({ title: '', time: '', type: 'outro' as EventType, syncToGoogle: false });

  const { connected, loading, googleEvents, connect, disconnect, fetchEvents, createEvent, deleteGoogleEvent } = useGoogleCalendar();

  // Persist
  useEffect(() => { localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(localEvents)); }, [localEvents]);
  useEffect(() => { localStorage.setItem(COLORS_KEY, JSON.stringify(colors)); }, [colors]);

  // Fetch Google events when month changes / connected
  useEffect(() => {
    if (connected) fetchEvents(current.year, current.month);
  }, [connected, current.year, current.month, fetchEvents]);

  // Fetch shooting schedules from Supabase (the "Gravações" module)
  useEffect(() => {
    const loadShootings = async () => {
      const startOfMonth = new Date(current.year, current.month, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(current.year, current.month + 1, 0).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('shooting_schedules')
        .select('id, title, shooting_date, start_time')
        .gte('shooting_date', startOfMonth)
        .lte('shooting_date', endOfMonth);
      if (error) {
        console.error('Erro ao carregar gravações:', error);
        return;
      }
      const mapped: CalEvent[] = (data || []).map((s: any) => ({
        id: `s_${s.id}`,
        title: s.title,
        date: s.shooting_date,
        time: s.start_time ? s.start_time.slice(0, 5) : undefined,
        type: 'gravacao',
        source: 'shooting',
      }));
      setShootings(mapped);
    };
    loadShootings();
  }, [current.year, current.month]);

  // Merge events
  const events: CalEvent[] = useMemo(() => {
    const mappedGoogle: CalEvent[] = googleEvents.map(ev => {
      const startDate = ev.start?.dateTime || ev.start?.date || '';
      const dateOnly = startDate.split('T')[0];
      const timeOnly = ev.start?.dateTime ? new Date(ev.start.dateTime).toTimeString().slice(0, 5) : undefined;
      return {
        id: `g_${ev.id}`,
        title: ev.summary || '(Sem título)',
        date: dateOnly,
        time: timeOnly,
        type: 'google',
        source: 'google',
      };
    });
    return [...localEvents, ...mappedGoogle, ...shootings];
  }, [localEvents, googleEvents, shootings]);

  // === Month view helpers ===
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const firstDay = new Date(current.year, current.month, 1).getDay();
  const monthCells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  // === Week view helpers ===
  const weekStart = useMemo(() => {
    const d = new Date(current.year, current.month, current.day);
    const dow = d.getDay();
    d.setDate(d.getDate() - dow);
    return d;
  }, [current]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]);

  const navigate = (dir: -1 | 1) => {
    if (view === 'month') {
      setCurrent(c => {
        const m = c.month + dir;
        if (m < 0) return { ...c, year: c.year - 1, month: 11 };
        if (m > 11) return { ...c, year: c.year + 1, month: 0 };
        return { ...c, month: m };
      });
    } else {
      const d = new Date(current.year, current.month, current.day);
      d.setDate(d.getDate() + dir * 7);
      setCurrent({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
    }
  };

  const dateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const openAdd = (ds: string) => {
    setSelectedDate(ds);
    setForm({ title: '', time: '', type: 'outro', syncToGoogle: connected });
    setShowModal(true);
  };

  const addEvent = async () => {
    if (!form.title.trim()) return;
    const newEv: CalEvent = {
      id: crypto.randomUUID(),
      title: form.title,
      time: form.time,
      type: form.type,
      date: selectedDate,
      source: 'local',
    };
    setLocalEvents(ev => [...ev, newEv]);
    if (form.syncToGoogle && connected) {
      await createEvent(form.title, selectedDate);
      fetchEvents(current.year, current.month);
    }
    setShowModal(false);
  };

  const removeEvent = async (ev: CalEvent) => {
    if (ev.source === 'google') {
      const realId = ev.id.replace(/^g_/, '');
      await deleteGoogleEvent(realId);
      fetchEvents(current.year, current.month);
    } else if (ev.source === 'shooting') {
      // Don't delete from DB silently — just inform
      return;
    } else {
      setLocalEvents(list => list.filter(e => e.id !== ev.id));
    }
  };

  const todayStr = today.toISOString().split('T')[0];

  const headerLabel = view === 'month'
    ? `${MONTHS[current.month]} ${current.year}`
    : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()].slice(0,3)} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()].slice(0,3)} ${weekDays[6].getFullYear()}`;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl shadow-inner">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            Calendário
          </h1>
          <p className="text-muted-foreground text-sm font-medium ml-1">Gerencie suas reuniões, gravações e eventos integrados</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center p-1 bg-secondary/40 backdrop-blur-md rounded-xl border border-border/50">
            <button
              onClick={() => setView('month')}
              className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300', view === 'month' ? 'bg-background shadow-sm text-foreground scale-[1.02]' : 'text-muted-foreground hover:text-foreground')}
            >Mês</button>
            <button
              onClick={() => setView('week')}
              className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300', view === 'week' ? 'bg-background shadow-sm text-foreground scale-[1.02]' : 'text-muted-foreground hover:text-foreground')}
            >Semana</button>
          </div>

          <Button variant="outline" onClick={() => setShowColors(true)} className="gap-2 rounded-xl h-10 border-border/50 bg-background/50 hover:bg-background shadow-sm">
            <Palette className="h-4 w-4" /> Cores
          </Button>

          {connected ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-1 pl-3 rounded-xl">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mr-1 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Google conectado
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" onClick={() => fetchEvents(current.year, current.month)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20 text-destructive" onClick={disconnect}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={connect} disabled={loading} className="gap-2 rounded-xl h-10 bg-[#4285F4] hover:bg-[#3367D6] text-white shadow-md transition-all">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Google Agenda
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center bg-card/30 p-2 rounded-xl border border-border/40 w-fit">
        <span className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">Legenda:</span>
        {(Object.keys(TYPE_LABELS) as EventType[]).map(t => (
          <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm" style={chipStyle(colors[t])}>
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60 bg-secondary/20">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl bg-background/50 hover:bg-background shadow-sm border-border/50"><ChevronLeft className="h-5 w-5" /></Button>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{headerLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} className="rounded-xl bg-background/50 hover:bg-background shadow-sm border-border/50"><ChevronRight className="h-5 w-5" /></Button>
        </div>

        {view === 'month' ? (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/10">
              {DAYS.map(d => <div key={d} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">{d}</div>)}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7">
              {monthCells.map((day, idx) => {
                const ds = day ? dateStr(current.year, current.month, day) : '';
                const dayEvents = day ? events.filter(e => e.date === ds) : [];
                const isToday = ds === todayStr;
                return (
                  <div
                    key={idx}
                    onClick={() => day && openAdd(ds)}
                    className={cn(
                      'min-h-[130px] p-2.5 border-b border-r border-border/30 transition-all duration-200 group relative',
                      day ? 'cursor-pointer hover:bg-secondary/40' : 'bg-muted/10 cursor-default',
                      isToday && 'bg-primary/[0.03]'
                    )}
                  >
                    {day && (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className={cn('text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all',
                            isToday ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/10' : 'text-muted-foreground group-hover:text-foreground group-hover:bg-secondary'
                          )}>{day}</span>
                        </div>
                        <div className="space-y-1.5">
                          {dayEvents.map(ev => (
                            <div key={ev.id} className="text-[11px] font-semibold px-2 py-1 rounded-md flex items-center justify-between gap-1 group/event shadow-sm border" style={chipStyle(colors[ev.type])}>
                              <span className="truncate flex items-center gap-1.5">
                                {ev.source === 'shooting' && <Video className="h-3 w-3 shrink-0 opacity-70" />}
                                {ev.title}
                              </span>
                              {ev.source !== 'shooting' && (
                                <button onClick={e => { e.stopPropagation(); removeEvent(ev); }} className="opacity-0 group-hover/event:opacity-100 hover:text-destructive transition-opacity bg-background/50 rounded-sm p-0.5">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // === WEEK VIEW ===
          <div className="grid grid-cols-7">
            {weekDays.map((d, idx) => {
              const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
              const dayEvents = events.filter(e => e.date === ds).sort((a,b) => (a.time || '').localeCompare(b.time || ''));
              const isToday = ds === todayStr;
              return (
                <div key={idx} className="border-r border-border/30 last:border-r-0 min-h-[500px]">
                  <div
                    onClick={() => openAdd(ds)}
                    className={cn(
                      'sticky top-0 px-2 py-4 border-b border-border/60 text-center cursor-pointer transition-all duration-200',
                      isToday ? 'bg-primary/10 border-b-primary/30' : 'bg-secondary/10 hover:bg-secondary/40'
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{DAYS[idx]}</div>
                    <div className={cn('text-2xl font-bold mt-1 inline-flex w-10 h-10 items-center justify-center rounded-full', isToday ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground')}>{d.getDate()}</div>
                  </div>
                  <div className="p-2 space-y-2" onClick={() => openAdd(ds)}>
                    {dayEvents.length === 0 && (
                      <div className="group/add flex flex-col items-center justify-center py-6 px-2 border border-dashed border-transparent hover:border-primary/30 hover:bg-primary/5 rounded-xl transition-all cursor-pointer">
                        <Plus className="h-5 w-5 text-muted-foreground/30 group-hover/add:text-primary/70 mb-1" />
                        <p className="text-xs font-medium text-muted-foreground/50 group-hover/add:text-primary/70">Adicionar</p>
                      </div>
                    )}
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="text-xs px-2.5 py-2 rounded-lg group/event shadow-sm border" style={chipStyle(colors[ev.type])} onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold line-clamp-2 leading-tight flex items-start gap-1.5">
                            {ev.source === 'shooting' && <Video className="h-3.5 w-3.5 shrink-0 opacity-70 mt-0.5" />}
                            {ev.title}
                          </span>
                          {ev.source !== 'shooting' && (
                            <button onClick={() => removeEvent(ev)} className="opacity-0 group-hover/event:opacity-100 hover:text-destructive transition-opacity bg-background/50 rounded-md p-1 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {ev.time && <div className="opacity-80 mt-1.5 font-medium flex items-center gap-1 bg-background/30 w-fit px-1.5 py-0.5 rounded"><Clock className="h-3 w-3" />{ev.time}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md shadow-sm p-6 xl:p-8">
        <h3 className="text-xl font-extrabold tracking-tight text-foreground mb-6 flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          Próximos Eventos
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0,8).map(ev => (
            <div key={ev.id} className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-border/60 bg-background/80 hover:bg-background shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300">
              <div className="flex items-start justify-between">
                <Badge style={chipStyle(colors[ev.type])} className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border">{TYPE_LABELS[ev.type]}</Badge>
                {ev.source !== 'shooting' && (
                  <button onClick={() => removeEvent(ev)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all bg-secondary rounded-full p-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1">
                <p className="text-base font-bold text-foreground line-clamp-2 leading-tight flex items-start gap-1.5">
                  {ev.source === 'shooting' && <Video className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
                  {ev.title}
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-muted-foreground bg-secondary/50 w-fit px-2.5 py-1.5 rounded-lg border border-border/50">
                  <Calendar className="h-3.5 w-3.5" />
                  {ev.date.split('-').reverse().join('/')}
                  {ev.time && <span className="flex items-center gap-1.5 ml-1.5 border-l border-border/60 pl-2.5"><Clock className="h-3.5 w-3.5" />{ev.time}</span>}
                </div>
              </div>
            </div>
          ))}
          {events.filter(e => e.date >= todayStr).length === 0 && (
            <div className="col-span-full py-12 text-center bg-secondary/30 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-semibold text-foreground">Agenda livre</p>
              <p className="text-sm text-muted-foreground">Nenhum evento futuro programado no momento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add event modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Evento — {selectedDate}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Ex: Reunião com cliente" className="mt-1" /></div>
            <div><Label>Horário</Label><Input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} className="mt-1" /></div>
            <div><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v as EventType}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="gravacao">Gravação</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {connected && (
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.syncToGoogle}
                  onChange={e => setForm(f => ({ ...f, syncToGoogle: e.target.checked }))}
                  className="rounded border-border"
                />
                Sincronizar com Google Agenda
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={addEvent} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Color customization modal */}
      <Dialog open={showColors} onOpenChange={setShowColors}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Cores por Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {(Object.keys(TYPE_LABELS) as EventType[]).map(t => (
              <div key={t} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground flex items-center gap-2 flex-1">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: colors[t] }} />
                  {TYPE_LABELS[t]}
                </span>
                <input
                  type="color"
                  value={colors[t]}
                  onChange={e => setColors(c => ({ ...c, [t]: e.target.value }))}
                  className="w-16 h-9 rounded cursor-pointer bg-transparent border border-border"
                />
                <span className="text-xs text-muted-foreground font-mono w-20">{colors[t]}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColors(DEFAULT_COLORS)}>Restaurar padrão</Button>
            <Button onClick={() => setShowColors(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
