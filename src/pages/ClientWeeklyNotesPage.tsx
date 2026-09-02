import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, NotebookPen, Crown, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyNote {
  id: string;
  client_id: string;
  week_start: string;
  title: string;
  content: string;
  highlight: string;
  author_user_id: string | null;
  author_name: string;
  is_account_manager: boolean;
  created_at: string;
}

const currentWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const emptyForm = { client_id: '', week_start: currentWeekStart(), title: '', content: '' };

export default function ClientWeeklyNotesPage() {
  const { clients } = useAgency();
  const { user } = useAuth();
  const [notes, setNotes] = useState<WeeklyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterWeek, setFilterWeek] = useState<string>('');

  const userName: string =
    (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || '';

  const activeClients = useMemo(
    () => clients.filter(c => c.status !== 'Cancelado'),
    [clients],
  );

  const fetchNotes = async () => {
    const { data, error } = await (supabase as any)
      .from('client_weekly_notes')
      .select('*')
      .order('week_start', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar observações');
    setNotes((data as WeeklyNote[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, []);

  const isAccountManagerOf = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !userName) return false;
    return (client.accountManager || []).some(
      m => m.trim().toLowerCase() === userName.trim().toLowerCase(),
    );
  };

  const handleSave = async () => {
    if (!form.client_id || !form.content.trim()) {
      toast.error('Selecione o cliente e escreva a observação');
      return;
    }
    const payload = {
      client_id: form.client_id,
      week_start: form.week_start || currentWeekStart(),
      title: form.title,
      content: form.content,
      author_user_id: user?.id ?? null,
      author_name: userName,
      is_account_manager: isAccountManagerOf(form.client_id),
      highlight: isAccountManagerOf(form.client_id) ? 'account_manager' : 'normal',
    };

    if (editId) {
      const { error } = await (supabase as any)
        .from('client_weekly_notes').update(payload).eq('id', editId);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Observação atualizada');
    } else {
      const { error } = await (supabase as any)
        .from('client_weekly_notes').insert(payload);
      if (error) { toast.error('Erro ao salvar'); return; }
      toast.success('Observação registrada');
    }
    setForm(emptyForm); setEditId(null); setOpen(false); fetchNotes();
  };

  const handleEdit = (n: WeeklyNote) => {
    setForm({ client_id: n.client_id, week_start: n.week_start, title: n.title, content: n.content });
    setEditId(n.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('client_weekly_notes').delete().eq('id', id);
    if (error) { toast.error('Sem permissão para excluir'); return; }
    toast.success('Observação removida'); fetchNotes();
  };

  const filtered = notes.filter(n =>
    (filterClient === 'all' || n.client_id === filterClient) &&
    (!filterWeek || n.week_start === filterWeek),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, WeeklyNote[]>();
    filtered.forEach(n => {
      const list = map.get(n.week_start) || [];
      list.push(n);
      map.set(n.week_start, list);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const weekLabel = (week: string) => {
    const start = parseISO(week);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, "dd 'de' MMM", { locale: ptBR })} — ${format(end, "dd 'de' MMM", { locale: ptBR })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observações Semanais</h1>
          <p className="text-sm text-muted-foreground">
            Registro semanal do que aconteceu com cada cliente
          </p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Observação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Nova'} Observação Semanal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {activeClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.client_id && isAccountManagerOf(form.client_id) && (
                  <p className="mt-1 text-xs text-primary flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Você é o account manager deste cliente — o card será destacado.
                  </p>
                )}
              </div>
              <div>
                <Label>Semana (segunda-feira)</Label>
                <Input type="date" value={form.week_start}
                  onChange={e => setForm({ ...form, week_start: e.target.value })} />
              </div>
              <div>
                <Label>Título</Label>
                <Input value={form.title} placeholder="Ex: Resumo da semana"
                  onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Observação *</Label>
                <Textarea rows={7} value={form.content}
                  placeholder="O que aconteceu, entregas, pendências, humor do cliente..."
                  onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-[280px]">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input type="date" className="w-full sm:w-[200px]" value={filterWeek}
          onChange={e => setFilterWeek(e.target.value)} />
        {(filterClient !== 'all' || filterWeek) && (
          <Button variant="ghost" onClick={() => { setFilterClient('all'); setFilterWeek(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <NotebookPen className="h-12 w-12 mb-3 opacity-40" />
          <p>Nenhuma observação registrada</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([week, list]) => (
            <div key={week} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Semana de {weekLabel(week)}
                <span className="text-xs font-normal">({list.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {list.map(n => {
                  const client = clients.find(c => c.id === n.client_id);
                  const am = n.is_account_manager;
                  return (
                    <Card
                      key={n.id}
                      className={
                        am
                          ? 'border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)] relative overflow-hidden'
                          : 'border-border'
                      }
                    >
                      {am && <div className="absolute left-0 top-0 h-full w-1 bg-primary" />}
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">
                              {client?.companyName || 'Cliente removido'}
                            </p>
                            {n.title && <p className="text-xs text-muted-foreground">{n.title}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {am && (
                              <Badge className="bg-primary text-primary-foreground gap-1">
                                <Crown className="h-3 w-3" /> Account Manager
                              </Badge>
                            )}
                            <button onClick={() => handleEdit(n)} aria-label="Editar">
                              <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </button>
                            <button onClick={() => handleDelete(n.id)} aria-label="Excluir">
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap ${am ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {n.content}
                        </p>
                        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          por {n.author_name || 'Desconhecido'} · {format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
