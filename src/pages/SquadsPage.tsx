import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, Building2, X, Loader2, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Squad {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}
interface Member { id: string; squad_id: string; user_id: string; role_label: string | null; }
interface SquadClient { id: string; squad_id: string; client_id: string; }
interface Profile { id: string; full_name: string | null; username: string | null; job_title: string | null; }
interface ClientRow { id: string; company_name: string; }

export default function SquadsPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [squadClients, setSquadClients] = useState<SquadClient[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Squad | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#BFF720' });

  const loadAll = async () => {
    setLoading(true);
    const [s, m, sc, p, c] = await Promise.all([
      supabase.from('squads').select('*').order('created_at', { ascending: false }),
      supabase.from('squad_members').select('*'),
      supabase.from('squad_clients').select('*'),
      supabase.from('profiles').select('id, full_name, username, job_title').eq('is_active', true).not('username', 'is', null),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ]);
    setSquads((s.data ?? []) as Squad[]);
    setMembers((m.data ?? []) as Member[]);
    setSquadClients((sc.data ?? []) as SquadClient[]);
    setProfiles((p.data ?? []) as Profile[]);
    setClients((c.data ?? []) as ClientRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: '#BFF720' });
    setDialogOpen(true);
  };
  const openEdit = (sq: Squad) => {
    setEditing(sq);
    setForm({ name: sq.name, description: sq.description ?? '', color: sq.color ?? '#BFF720' });
    setDialogOpen(true);
  };

  const saveSquad = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      const { error } = await supabase.from('squads').update({
        name: form.name, description: form.description || null, color: form.color,
      }).eq('id', editing.id);
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await supabase.from('squads').insert({
        name: form.name, description: form.description || null, color: form.color,
      });
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setDialogOpen(false);
    loadAll();
  };

  const deleteSquad = async (id: string) => {
    if (!confirm('Excluir esse squad?')) return;
    const { error } = await supabase.from('squads').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    loadAll();
  };

  const addMember = async (squadId: string, userId: string, roleLabel: string) => {
    const { error } = await supabase.from('squad_members').insert({
      squad_id: squadId, user_id: userId, role_label: roleLabel || null,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    loadAll();
  };
  const removeMember = async (id: string) => {
    await supabase.from('squad_members').delete().eq('id', id);
    loadAll();
  };
  const addClient = async (squadId: string, clientId: string) => {
    const { error } = await supabase.from('squad_clients').insert({ squad_id: squadId, client_id: clientId });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    loadAll();
  };
  const removeClient = async (id: string) => {
    await supabase.from('squad_clients').delete().eq('id', id);
    loadAll();
  };

  const profileName = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p?.full_name || p?.username || 'Sem nome';
  };
  const clientName = (id: string) => clients.find(x => x.id === id)?.company_name ?? 'Cliente';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1 font-bold">Squads</h1>
          <p className="text-body text-muted-foreground">Organize equipes por conjunto de clientes atendidos.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Squad
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : squads.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum squad criado ainda. Clique em "Novo Squad" para começar.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {squads.map(sq => (
            <SquadCard
              key={sq.id}
              squad={sq}
              members={members.filter(m => m.squad_id === sq.id)}
              squadClients={squadClients.filter(c => c.squad_id === sq.id)}
              profiles={profiles}
              clients={clients}
              profileName={profileName}
              clientName={clientName}
              onEdit={() => openEdit(sq)}
              onDelete={() => deleteSquad(sq.id)}
              onAddMember={addMember}
              onRemoveMember={removeMember}
              onAddClient={addClient}
              onRemoveClient={removeClient}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Squad' : 'Novo Squad'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Nome</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Squad Alpha" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Cor</label>
              <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10 w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSquad}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SquadCard(props: {
  squad: Squad;
  members: Member[];
  squadClients: SquadClient[];
  profiles: Profile[];
  clients: ClientRow[];
  profileName: (id: string) => string;
  clientName: (id: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  onAddMember: (squadId: string, userId: string, roleLabel: string) => void;
  onRemoveMember: (id: string) => void;
  onAddClient: (squadId: string, clientId: string) => void;
  onRemoveClient: (id: string) => void;
}) {
  const { squad, members, squadClients, profiles, clients, profileName, clientName } = props;
  const [newMemberId, setNewMemberId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newClientId, setNewClientId] = useState('');

  const availableProfiles = useMemo(
    () => profiles.filter(p => !members.some(m => m.user_id === p.id)),
    [profiles, members],
  );
  const availableClients = useMemo(
    () => clients.filter(c => !squadClients.some(sc => sc.client_id === c.id)),
    [clients, squadClients],
  );

  return (
    <Card className="p-4 space-y-4 border-l-4" style={{ borderLeftColor: squad.color ?? '#BFF720' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg truncate">{squad.name}</h3>
          {squad.description && <p className="text-xs text-muted-foreground line-clamp-2">{squad.description}</p>}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={props.onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={props.onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" /> Membros ({members.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {members.map(m => (
            <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
              {profileName(m.user_id)}{m.role_label ? ` · ${m.role_label}` : ''}
              <button onClick={() => props.onRemoveMember(m.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {members.length === 0 && <span className="text-xs text-muted-foreground">Nenhum membro</span>}
        </div>
        <div className="flex gap-2">
          <Select value={newMemberId} onValueChange={setNewMemberId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar membro" /></SelectTrigger>
            <SelectContent>
              {availableProfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Função" value={newRole} onChange={e => setNewRole(e.target.value)} className="w-28" />
          <Button size="sm" disabled={!newMemberId} onClick={() => {
            props.onAddMember(squad.id, newMemberId, newRole);
            setNewMemberId(''); setNewRole('');
          }}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" /> Clientes ({squadClients.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {squadClients.map(sc => (
            <Badge key={sc.id} variant="outline" className="gap-1 pr-1">
              {clientName(sc.client_id)}
              <button onClick={() => props.onRemoveClient(sc.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {squadClients.length === 0 && <span className="text-xs text-muted-foreground">Nenhum cliente</span>}
        </div>
        <div className="flex gap-2">
          <Select value={newClientId} onValueChange={setNewClientId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar cliente" /></SelectTrigger>
            <SelectContent>
              {availableClients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!newClientId} onClick={() => {
            props.onAddClient(squad.id, newClientId);
            setNewClientId('');
          }}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}
