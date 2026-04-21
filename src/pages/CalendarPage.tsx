import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Trash2, Link2, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

type EventType = 'reuniao' | 'gravacao' | 'entrega' | 'outro' | 'google';
interface CalEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: EventType;
  source?: 'local' | 'google';
}

const EVENT_COLORS: Record<EventType, string> = {
  reuniao: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  gravacao: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  entrega: 'bg-primary/20 text-primary border-primary/30',
  outro: 'bg-muted text-muted-foreground border-border',
  google: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const LOCAL_EVENTS_KEY = 'calendar_local_events';

export default function CalendarPage() {
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [localEvents, setLocalEvents] = useState<CalEvent[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [form, setForm] = useState({ title: '', time: '', type: 'outro' as EventType, syncToGoogle: false });

  const { connected, loading, googleEvents, connect, disconnect, fetchEvents, createEvent, deleteGoogleEvent } = useGoogleCalendar();

  // Persist local events
  useEffect(() => {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(localEvents));
  }, [localEvents]);

  // Fetch Google events when month changes or when connected
  useEffect(() => {
    if (connected) fetchEvents(current.year, current.month);
  }, [connected, current.year, current.month, fetchEvents]);

  // Merge local + Google events
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
    return [...localEvents, ...mappedGoogle];
  }, [localEvents, googleEvents]);

  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const firstDay = new Date(current.year, current.month, 1).getDay();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const prevMonth = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const nextMonth = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  const dateStr = (day: number) => `${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const openAdd = (day: number) => {
    setSelectedDate(dateStr(day));
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
    } else {
      setLocalEvents(list => list.filter(e => e.id !== ev.id));
    }
  };

  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Calendar className="h-6 w-6 text-primary" /> Calendário</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus eventos e sincronize com o Google Agenda</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Google conectado</Badge>
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

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <button onClick={prevMonth} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-5 w-5" /></button>
          <h2 className="text-lg font-semibold text-foreground">{MONTHS[current.month]} {current.year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const ds = day ? dateStr(day) : '';
            const dayEvents = day ? events.filter(e => e.date === ds) : [];
            const isToday = ds === todayStr;
            return (
              <div
                key={idx}
                onClick={() => day && openAdd(day)}
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
                        <div key={ev.id} className={cn('text-xs px-1.5 py-0.5 rounded border flex items-center justify-between gap-1 group', EVENT_COLORS[ev.type])}>
                          <span className="truncate">{ev.title}</span>
                          <button onClick={e => { e.stopPropagation(); removeEvent(ev); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Próximos Eventos</h3>
        {events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0,8).map(ev => (
          <div key={ev.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-xs', EVENT_COLORS[ev.type])}>{ev.type}</Badge>
              <div>
                <p className="text-sm font-medium text-foreground">{ev.title}</p>
                <p className="text-xs text-muted-foreground">{ev.date}{ev.time ? ` às ${ev.time}` : ''}</p>
              </div>
            </div>
            <button onClick={() => removeEvent(ev)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {events.filter(e => e.date >= todayStr).length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>}
      </div>

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
    </div>
  );
}
