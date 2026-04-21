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
  backgroundColor: `${hex}33`, // ~20% alpha
  color: hex,
  borderColor: `${hex}55`,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Calendário
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Reuniões, gravações e eventos do Google em um só lugar</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1.5 text-sm transition-colors', view === 'month' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >Mês</button>
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1.5 text-sm transition-colors', view === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >Semana</button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowColors(true)} className="gap-1">
            <Palette className="h-4 w-4" /> Cores
          </Button>

          {connected ? (
            <>
              <Badge style={chipStyle(colors.google)}>Google conectado</Badge>
              <Button variant="outline" size="sm" onClick={() => fetchEvents(current.year, current.month)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect}>
                <LogOut className="h-4 w-4 mr-1" /> Desconectar
              </Button>
            </>
          ) : (
            <Button onClick={connect} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Google Agenda
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as EventType[]).map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-md" style={chipStyle(colors[t])}>
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-5 w-5" /></button>
          <h2 className="text-lg font-semibold text-foreground">{headerLabel}</h2>
          <button onClick={() => navigate(1)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {view === 'month' ? (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
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
                      'min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors',
                      day ? 'hover:bg-secondary/50' : 'bg-muted/20 cursor-default',
                      isToday && 'bg-primary/5'
                    )}
                  >
                    {day && (
                      <>
                        <span className={cn('text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                          isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                        )}>{day}</span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.map(ev => (
                            <div key={ev.id} className="text-xs px-1.5 py-0.5 rounded flex items-center justify-between gap-1 group" style={chipStyle(colors[ev.type])}>
                              <span className="truncate flex items-center gap-1">
                                {ev.source === 'shooting' && <Video className="h-3 w-3 shrink-0" />}
                                {ev.title}
                              </span>
                              {ev.source !== 'shooting' && (
                                <button onClick={e => { e.stopPropagation(); removeEvent(ev); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
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
                <div key={idx} className="border-r border-border last:border-r-0 min-h-[400px]">
                  <div
                    onClick={() => openAdd(ds)}
                    className={cn(
                      'sticky top-0 px-2 py-2 border-b border-border text-center cursor-pointer transition-colors',
                      isToday ? 'bg-primary/10' : 'bg-card hover:bg-secondary/40'
                    )}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">{DAYS[idx]}</div>
                    <div className={cn('text-lg font-semibold mt-0.5', isToday ? 'text-primary' : 'text-foreground')}>{d.getDate()}</div>
                  </div>
                  <div className="p-2 space-y-1.5" onClick={() => openAdd(ds)}>
                    {dayEvents.length === 0 && (
                      <p className="text-xs text-muted-foreground/50 text-center py-4">+ Adicionar</p>
                    )}
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="text-xs px-2 py-1.5 rounded group" style={chipStyle(colors[ev.type])} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium truncate flex items-center gap-1">
                            {ev.source === 'shooting' && <Video className="h-3 w-3 shrink-0" />}
                            {ev.title}
                          </span>
                          {ev.source !== 'shooting' && (
                            <button onClick={() => removeEvent(ev)} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {ev.time && <div className="opacity-70 mt-0.5">{ev.time}</div>}
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
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Próximos Eventos</h3>
        {events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0,8).map(ev => (
          <div key={ev.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <Badge style={chipStyle(colors[ev.type])} className="text-xs">{TYPE_LABELS[ev.type]}</Badge>
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-1">
                  {ev.source === 'shooting' && <Video className="h-3 w-3" />}
                  {ev.title}
                </p>
                <p className="text-xs text-muted-foreground">{ev.date}{ev.time ? ` às ${ev.time}` : ''}</p>
              </div>
            </div>
            {ev.source !== 'shooting' && (
              <button onClick={() => removeEvent(ev)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {events.filter(e => e.date >= todayStr).length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>}
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
