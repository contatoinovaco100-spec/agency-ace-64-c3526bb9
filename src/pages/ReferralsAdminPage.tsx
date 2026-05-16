import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Gift, Link2, Plus, Copy, Trash2, Pencil, Trophy, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Referral, ReferralClient, ReferralStatus, ReferralTier, STATUS_LABELS } from '@/types/referrals';

export default function ReferralsAdminPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ReferralClient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [tiers, setTiers] = useState<ReferralTier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [c, r, t] = await Promise.all([
      supabase.from('referral_clients').select('*').order('created_at', { ascending: false }),
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('referral_tiers').select('*').order('sort_order', { ascending: true }),
    ]);
    setClients((c.data ?? []) as ReferralClient[]);
    setReferrals((r.data ?? []) as Referral[]);
    setTiers((t.data ?? []) as ReferralTier[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const closedByClient = (cid: string) => referrals.filter(r => r.client_id === cid && r.status === 'fechada').length;
  const totalByClient = (cid: string) => referrals.filter(r => r.client_id === cid).length;

  const tierOf = (closed: number) => {
    const sorted = [...tiers].sort((a, b) => b.required_count - a.required_count);
    return sorted.find(t => closed >= t.required_count)?.name ?? '—';
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Programa de Indicações</h1>
        <p className="text-sm text-muted-foreground">Gerencie clientes, indicações e premiações.</p>
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients" className="gap-2"><Users className="h-4 w-4" /> Clientes</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-2"><Link2 className="h-4 w-4" /> Indicações</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-2"><Gift className="h-4 w-4" /> Premiações</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-6">
          <ClientsTab
            clients={clients}
            loading={loading}
            closedByClient={closedByClient}
            totalByClient={totalByClient}
            tierOf={tierOf}
            onChange={fetchAll}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="referrals" className="mt-6">
          <ReferralsTab
            clients={clients}
            referrals={referrals}
            onChange={fetchAll}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="tiers" className="mt-6">
          <TiersTab tiers={tiers} onChange={fetchAll} toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================== CLIENTS TAB =========================== */
function ClientsTab({
  clients, loading, closedByClient, totalByClient, tierOf, onChange, toast,
}: {
  clients: ReferralClient[];
  loading: boolean;
  closedByClient: (id: string) => number;
  totalByClient: (id: string) => number;
  tierOf: (closed: number) => string;
  onChange: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('referral_clients').insert({ name: name.trim() });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setName(''); setOpen(false); onChange();
    toast({ title: 'Cliente criado', description: 'Link de indicação gerado com sucesso.' });
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este cliente e todas as suas indicações?')) return;
    const { error } = await supabase.from('referral_clients').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onChange();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/indicacoes/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link do painel copiado!', description: url });
  };

  const copyFormLink = (token: string) => {
    const url = `${window.location.origin}/indicar/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link do formulário copiado!', description: url });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Clientes ({clients.length})</h2>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Adicionar cliente</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Carregando…</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="py-2 px-2">Nome</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Fechadas</th>
                <th className="py-2 px-2">Tier</th>
                <th className="py-2 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const closed = closedByClient(c.id);
                return (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-muted/40">
                    <td className="py-3 px-2 font-medium">{c.name}</td>
                    <td className="py-3 px-2">{totalByClient(c.id)}</td>
                    <td className="py-3 px-2">{closed}</td>
                    <td className="py-3 px-2"><Badge variant="outline">{tierOf(closed)}</Badge></td>
                    <td className="py-3 px-2 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => copyLink(c.token)} className="gap-1">
                        <Copy className="h-3.5 w-3.5" /> Painel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyFormLink(c.token)} className="gap-1">
                        <Link2 className="h-3.5 w-3.5" /> Formulário
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome do cliente</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João da Silva" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || !name.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================== REFERRALS TAB =========================== */
function ReferralsTab({
  clients, referrals, onChange, toast,
}: {
  clients: ReferralClient[];
  referrals: Referral[];
  onChange: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  const filtered = filterClient === 'all' ? referrals : referrals.filter(r => r.client_id === filterClient);
  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? '—';

  const create = async () => {
    if (!clientId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('referrals').insert({
      client_id: clientId, referred_name: name.trim(), referred_whatsapp: whatsapp.trim(),
    });
    setSaving(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setName(''); setWhatsapp(''); setOpen(false); onChange();
    toast({ title: 'Indicação adicionada' });
  };

  const updateStatus = async (id: string, status: ReferralStatus) => {
    const { error } = await supabase.from('referrals').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta indicação?')) return;
    const { error } = await supabase.from('referrals').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onChange();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Indicações ({filtered.length})</h2>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2" disabled={clients.length === 0}>
          <Plus className="h-4 w-4" /> Adicionar indicação
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma indicação encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Indicado</th>
                <th className="py-2 px-2">WhatsApp</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/40">
                  <td className="py-3 px-2 text-muted-foreground">{clientName(r.client_id)}</td>
                  <td className="py-3 px-2 font-medium">{r.referred_name}</td>
                  <td className="py-3 px-2 text-muted-foreground">{r.referred_whatsapp || '—'}</td>
                  <td className="py-3 px-2">
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as ReferralStatus)}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ReferralStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova indicação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do indicado</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || !clientId || !name.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================== TIERS TAB =========================== */
function TiersTab({
  tiers, onChange, toast,
}: {
  tiers: ReferralTier[];
  onChange: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReferralTier | null>(null);
  const [form, setForm] = useState({ name: '', required_count: 1, prize_description: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', required_count: 1, prize_description: '', sort_order: tiers.length + 1 });
    setOpen(true);
  };

  const openEdit = (t: ReferralTier) => {
    setEditing(t);
    setForm({ name: t.name, required_count: t.required_count, prize_description: t.prize_description, sort_order: t.sort_order });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || form.required_count < 1) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      required_count: Number(form.required_count),
      prize_description: form.prize_description.trim(),
      sort_order: Number(form.sort_order),
    };
    const { error } = editing
      ? await supabase.from('referral_tiers').update(payload).eq('id', editing.id)
      : await supabase.from('referral_tiers').insert(payload);
    setSaving(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setOpen(false); onChange();
    toast({ title: editing ? 'Tier atualizado' : 'Tier criado' });
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta premiação?')) return;
    const { error } = await supabase.from('referral_tiers').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onChange();
  };

  const move = async (tier: ReferralTier, direction: 'up' | 'down') => {
    const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(t => t.id === tier.id);
    const swapWith = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!swapWith) return;
    await Promise.all([
      supabase.from('referral_tiers').update({ sort_order: swapWith.sort_order }).eq('id', tier.id),
      supabase.from('referral_tiers').update({ sort_order: tier.sort_order }).eq('id', swapWith.id),
    ]);
    onChange();
  };

  const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Premiações ({tiers.length})</h2>
          <p className="text-xs text-muted-foreground">Configure os níveis de recompensa do programa.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo tier</Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum tier cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((t, idx) => (
            <div key={t.id} className="flex items-center gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/40">
              <Trophy className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="outline" className="text-[11px]">{t.required_count} indicações</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.prize_description || 'Sem descrição'}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => move(t, 'up')} disabled={idx === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(t, 'down')} disabled={idx === sorted.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar tier' : 'Novo tier'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Ouro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Indicações necessárias</Label>
                <Input type="number" min={1} value={form.required_count}
                  onChange={e => setForm(f => ({ ...f, required_count: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" min={0} value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição do prêmio</Label>
              <Textarea value={form.prize_description}
                onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))}
                rows={3} placeholder="Ex: Mês de mensalidade grátis" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              💾 Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
