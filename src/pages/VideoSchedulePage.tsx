import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Palette, Video, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAgency } from '@/contexts/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type BoardKind = 'video' | 'arte';

interface ScheduleEntry {
  id: string;
  week_start: string;
  day_of_week: number; // 1..6
  position: number;
  client_id: string | null;
  custom_label: string | null;
  note: string | null;
  board: BoardKind;
}

const DAYS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 sun ... 6 sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function VideoSchedulePage() {
  const { clients, tasks } = useAgency();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogDay, setDialogDay] = useState<number | null>(null);
  const [dialogBoard, setDialogBoard] = useState<BoardKind>('video');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');

  const weekStartISO = fmtISO(weekStart);

  const activeClients = useMemo(
    () => clients.filter(c => c.status !== 'Cancelado').sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [clients],
  );

  // Situação do cliente com base nas tarefas de vídeo:
  // 'alteracao' (amarelo) quando existe vídeo em alteração,
  // 'sem-edicao' (vermelho) quando não há nenhum vídeo em edição.
  const clientVideoState = useMemo(() => {
    const map = new Map<string, 'ok' | 'alteracao' | 'sem-edicao'>();
    for (const c of clients) {
      const clientTasks = tasks.filter(t => t.clientId === c.id && t.taskType !== 'Arte');
      const hasAlteracao = clientTasks.some(t => String(t.status).toLowerCase().includes('altera'));
      const hasEdicao = clientTasks.some(t => String(t.status).toLowerCase().includes('edição') || String(t.status).toLowerCase().includes('edicao'));
      map.set(c.id, hasAlteracao ? 'alteracao' : hasEdicao ? 'ok' : 'sem-edicao');
    }
    return map;
  }, [clients, tasks]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('video_schedule')
      .select('*')
      .eq('week_start', weekStartISO)
      .order('position', { ascending: true });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setEntries((data as ScheduleEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  const openAdd = (day: number, board: BoardKind) => {
    setDialogDay(day);
    setDialogBoard(board);
    setSelectedClientId('');
    setCustomLabel('');
    setNote('');
  };

  const saveEntry = async () => {
    if (dialogDay == null) return;
    if (!selectedClientId && !customLabel.trim()) {
      toast({ title: 'Selecione um cliente ou digite um rótulo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const dayEntries = entries.filter(e => e.day_of_week === dialogDay && e.board === dialogBoard);
    const nextPos = dayEntries.length ? Math.max(...dayEntries.map(e => e.position)) + 1 : 0;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from('video_schedule')
      .insert({
        week_start: weekStartISO,
        day_of_week: dialogDay,
        board: dialogBoard,
        position: nextPos,
        client_id: selectedClientId || null,
        custom_label: customLabel.trim() || null,
        note: note.trim() || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setEntries(prev => [...prev, data as ScheduleEntry]);
    setDialogDay(null);
  };

  const removeEntry = async (id: string) => {
    const prev = entries;
    setEntries(prev.filter(e => e.id !== id));
    const { error } = await (supabase as any).from('video_schedule').delete().eq('id', id);
    if (error) {
      setEntries(prev);
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const moveEntry = async (entry: ScheduleEntry, newDay: number) => {
    if (newDay === entry.day_of_week) return;
    const dayEntries = entries.filter(e => e.day_of_week === newDay && e.board === entry.board);
    const nextPos = dayEntries.length ? Math.max(...dayEntries.map(e => e.position)) + 1 : 0;
    const prev = entries;
    setEntries(prev.map(e => (e.id === entry.id ? { ...e, day_of_week: newDay, position: nextPos } : e)));
    const { error } = await (supabase as any)
      .from('video_schedule')
      .update({ day_of_week: newDay, position: nextPos })
      .eq('id', entry.id);
    if (error) {
      setEntries(prev);
      toast({ title: 'Erro ao mover', description: error.message, variant: 'destructive' });
    }
  };

  const copyPreviousWeek = async () => {
    const prevMonday = new Date(weekStart);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevISO = fmtISO(prevMonday);
    setCopying(true);
    const { data, error } = await (supabase as any)
      .from('video_schedule')
      .select('*')
      .eq('week_start', prevISO);
    if (error) {
      setCopying(false);
      toast({ title: 'Erro ao buscar semana anterior', description: error.message, variant: 'destructive' });
      return;
    }
    const rows = (data as ScheduleEntry[]) || [];
    if (rows.length === 0) {
      setCopying(false);
      toast({ title: 'Semana anterior está vazia', variant: 'destructive' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = rows.map(r => ({
      week_start: weekStartISO,
      day_of_week: r.day_of_week,
      board: r.board ?? 'video',
      position: r.position,
      client_id: r.client_id,
      custom_label: r.custom_label,
      note: r.note,
      created_by: user?.id ?? null,
    }));
    const { data: inserted, error: insErr } = await (supabase as any)
      .from('video_schedule')
      .insert(payload)
      .select();
    setCopying(false);
    if (insErr) {
      toast({ title: 'Erro ao copiar', description: insErr.message, variant: 'destructive' });
      return;
    }
    setEntries(prev => [...prev, ...((inserted as ScheduleEntry[]) || [])]);
    toast({ title: `${payload.length} itens copiados da semana anterior` });
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(getMonday(d));
  };

  const getClientName = (id: string | null) =>
    id ? clients.find(c => c.id === id)?.companyName || '—' : '';

  const rangeEnd = new Date(weekStart);
  rangeEnd.setDate(rangeEnd.getDate() + 5);

  const renderBoard = (board: BoardKind) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {DAYS.map((label, idx) => {
        const dayNum = idx + 1;
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + idx);
        const dayEntries = entries
          .filter(e => e.day_of_week === dayNum && (e.board ?? 'video') === board)
          .sort((a, b) => a.position - b.position);
        const isToday = fmtISO(dayDate) === fmtISO(new Date());
        return (
          <Card
            key={`${board}-${dayNum}`}
            onDragOver={e => { if (isAdmin) e.preventDefault(); }}
            onDrop={e => {
              if (!isAdmin) return;
              e.preventDefault();
              const id = e.dataTransfer.getData('entry_id');
              const entry = entries.find(x => x.id === id);
              if (entry && (entry.board ?? 'video') === board) moveEntry(entry, dayNum);
            }}
            className={cn(
              'flex flex-col overflow-hidden border',
              isToday && 'border-primary shadow-md shadow-primary/10',
            )}
          >
            <div
              className={cn(
                'px-3 py-2 border-b bg-muted/40 flex items-center justify-between',
                isToday && 'bg-primary/10',
              )}
            >
              <div>
                <p className="text-xs font-bold tracking-wide">{label}</p>
                <p className="text-[10px] text-muted-foreground">{fmtBR(dayDate)}</p>
              </div>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openAdd(dayNum, board)}
                  title="Adicionar cliente"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="p-2 space-y-1.5 min-h-[240px] flex-1">
              {dayEntries.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center pt-6">
                  {board === 'arte' ? 'Sem artes' : 'Sem vídeos'}
                </p>
              )}
              {dayEntries.map(entry => (
                <div
                  key={entry.id}
                  draggable={isAdmin}
                  onDragStart={e => e.dataTransfer.setData('entry_id', entry.id)}
                  className={cn(
                    'group border rounded-md px-2 py-1.5 text-xs bg-card hover:border-primary/60 transition-colors flex items-start justify-between gap-1',
                    isAdmin && 'cursor-grab active:cursor-grabbing',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate uppercase">
                      {entry.client_id ? getClientName(entry.client_id) : entry.custom_label}
                    </p>
                    {entry.note && (
                      <p className="text-[10px] text-muted-foreground truncate">{entry.note}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda de Vídeos e Artes
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {isAdmin
              ? 'Arraste ou adicione clientes em cada dia da semana.'
              : <><Lock className="h-3 w-3" /> Somente administradores podem trocar clientes de dia.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[160px] text-center">
            {fmtBR(weekStart)} – {fmtBR(rangeEnd)}
          </div>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(getMonday(new Date()))}>
            Hoje
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-primary">
              <Video className="h-4 w-4" /> Vídeos
            </h2>
            {renderBoard('video')}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-purple-400">
              <Palette className="h-4 w-4" /> Artes
            </h2>
            {renderBoard('arte')}
          </section>
        </div>
      )}

      <Dialog open={dialogDay !== null} onOpenChange={(o) => !o && setDialogDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adicionar {dialogBoard === 'arte' ? 'arte' : 'vídeo'} — {dialogDay ? DAYS[dialogDay - 1] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ou rótulo livre</label>
              <Input
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="Ex: LUNO, TERMINAR ID ODON..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observação (opcional)</label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex: Reels, Stories, ID Bronze..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDay(null)}>Cancelar</Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
