import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Clock, Calendar, Trash2, Pencil, Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ShootingSchedule {
  id: string; title: string; location: string; shooting_date: string;
  start_time: string | null; end_time: string | null; task_id: string | null;
  client_id: string | null; cast_notes: string; equipment_notes: string;
  notes: string; status: string;
}

const STATUSES = ['Agendada', 'Confirmada', 'Em andamento', 'Concluída', 'Cancelada'];
const statusColor: Record<string, string> = {
  'Agendada': 'bg-blue-500/10 text-blue-600',
  'Confirmada': 'bg-emerald-500/10 text-emerald-600',
  'Em andamento': 'bg-amber-500/10 text-amber-600',
  'Concluída': 'bg-muted text-muted-foreground',
  'Cancelada': 'bg-red-500/10 text-red-600',
};

const emptyForm = { title: '', location: '', shooting_date: '', start_time: '', end_time: '', task_id: '', client_id: '', cast_notes: '', equipment_notes: '', notes: '', status: 'Agendada' };

export default function ShootingSchedulePage() {
  const { clients, tasks } = useAgency();
  const [items, setItems] = useState<ShootingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    const { data } = await supabase.from('shooting_schedules').select('*').order('shooting_date', { ascending: true });
    setItems((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.title || !form.shooting_date) { toast.error('Título e data são obrigatórios'); return; }
    const payload = {
      title: form.title, location: form.location, shooting_date: form.shooting_date,
      start_time: form.start_time || null, end_time: form.end_time || null,
      task_id: form.task_id || null, client_id: form.client_id || null,
      cast_notes: form.cast_notes, equipment_notes: form.equipment_notes,
      notes: form.notes, status: form.status,
    };
    if (editId) {
      await supabase.from('shooting_schedules').update(payload as any).eq('id', editId);
      toast.success('Gravação atualizada');
    } else {
      await supabase.from('shooting_schedules').insert(payload as any);
      toast.success('Gravação agendada');
    }
    setForm(emptyForm); setEditId(null); setOpen(false); fetchData();
  };

  const handleEdit = (s: ShootingSchedule) => {
    setForm({ title: s.title, location: s.location, shooting_date: s.shooting_date, start_time: s.start_time || '', end_time: s.end_time || '', task_id: s.task_id || '', client_id: s.client_id || '', cast_notes: s.cast_notes, equipment_notes: s.equipment_notes, notes: s.notes, status: s.status });
    setEditId(s.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('shooting_schedules').delete().eq('id', id);
    toast.success('Gravação removida'); fetchData();
  };

  const upcoming = items.filter(i => i.status !== 'Concluída' && i.status !== 'Cancelada');
  const past = items.filter(i => i.status === 'Concluída' || i.status === 'Cancelada');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Gravações</h1>
          <p className="text-sm text-muted-foreground">Locações, diárias e elenco</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova Gravação</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? 'Editar' : 'Nova'} Gravação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Locação</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ex: Estúdio centro, Parque Ibirapuera..." /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Data *</Label><Input type="date" value={form.shooting_date} onChange={e => setForm({ ...form, shooting_date: e.target.value })} /></div>
                <div><Label>Início</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                  </Select>
                  {!form.client_id && <p className="mt-1 text-xs text-warning">Sem cliente, ele não recebe o lembrete no WhatsApp.</p>}
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Tarefa vinculada</Label>
                <Select value={form.task_id} onValueChange={v => setForm({ ...form, task_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>{tasks.filter(t => t.taskType === 'Produção de Vídeo').map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Elenco / Participantes</Label><Textarea value={form.cast_notes} onChange={e => setForm({ ...form, cast_notes: e.target.value })} /></div>
              <div><Label>Equipamentos necessários</Label><Textarea value={form.equipment_notes} onChange={e => setForm({ ...form, equipment_notes: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clapperboard className="h-12 w-12 mb-3 opacity-40" /><p>Nenhuma gravação agendada</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Próximas gravações</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map(s => {
                  const client = clients.find(c => c.id === s.client_id);
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{s.title}</h3>
                            {client && <p className="text-xs text-muted-foreground">{client.companyName}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColor[s.status] || ''}>{s.status}</Badge>
                            <button onClick={() => handleEdit(s)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></button>
                            <button onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(s.shooting_date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}</span>
                          {s.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.start_time?.slice(0,5)}{s.end_time ? ` – ${s.end_time.slice(0,5)}` : ''}</span>}
                          {s.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
                        </div>
                        {s.cast_notes && <p className="text-xs text-muted-foreground"><strong>Elenco:</strong> {s.cast_notes}</p>}
                        {s.equipment_notes && <p className="text-xs text-muted-foreground"><strong>Equip.:</strong> {s.equipment_notes}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-muted-foreground">Finalizadas / Canceladas</h2>
              <div className="grid gap-4 md:grid-cols-2 opacity-60">
                {past.map(s => (
                  <Card key={s.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.shooting_date + 'T12:00:00'), "dd/MM/yyyy")}{s.location ? ` · ${s.location}` : ''}</p>
                      </div>
                      <Badge className={statusColor[s.status] || ''}>{s.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
