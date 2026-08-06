import { useState, useEffect } from 'react';

import { useAgency } from '@/contexts/AgencyContext';
import { Client, ServiceType, ClientStatus, ScopeDetails } from '@/types/agency';
import { Plus, Search, X, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { MetaInsightsPanel } from '@/components/clients/MetaInsightsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClientDiagnosisTab } from '@/components/clients/ClientDiagnosisTab';
import { Shield, Lock, Mail, Key, Loader2, Link as LinkIcon, Target, Sparkles, Eye, EyeOff, Gift, Link2, Copy, MessageCircle, UserPlus, Users, RefreshCw } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

const serviceOptions: ServiceType[] = ['Gestor de trafego', 'Social Media', 'Estrategista digital', 'Editor de Video', 'Copywritter', 'Design'];
const statusOptions: ClientStatus[] = ['Ativo', 'Pausado', 'Cancelado'];

const statusColors: Record<string, string> = {
  'Ativo': 'bg-success/10 text-success',
  'Pausado': 'bg-warning/10 text-warning',
  'Cancelado': 'bg-destructive/10 text-destructive',
};

const emptyScope: ScopeDetails = { monthlyDeliverables: [], includedServices: [], demandLimits: '', platforms: [], strategicNotes: '' };

export default function ClientsPage() {
  const { clients, team, addClient, updateClient, deleteClient, refresh } = useAgency();
  const [syncing, setSyncing] = useState(false);

  const syncFromContracts = async () => {
    setSyncing(true);
    try {
      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('status', 'assinado');
      if (error) throw error;

      const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

      // Dedupe contracts by normalized client name — keep most recent
      const byName = new Map<string, any>();
      for (const c of contracts || []) {
        const key = norm(c.client_name);
        if (!key) continue;
        const prev = byName.get(key);
        const cDate = new Date((c as any).signed_at || c.created_at || 0).getTime();
        const pDate = prev ? new Date((prev as any).signed_at || prev.created_at || 0).getTime() : -1;
        if (!prev || cDate >= pDate) byName.set(key, c);
      }

      // Preload existing clients to lookup by normalized name (avoids duplicate inserts)
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, company_name, monthly_value, scope, email');
      const existingMap = new Map<string, any>();
      for (const ec of existingClients || []) existingMap.set(norm(ec.company_name), ec);

      let created = 0, updated = 0;
      for (const [key, c] of byName) {
        const name = (c.client_name || '').trim();
        const existing = existingMap.get(key);
        const payload = {
          company_name: name,
          contact_name: name,
          email: c.client_email || existing?.email || '',
          phone: '',
          contract_start_date: ((c as any).signed_at || c.created_at || new Date().toISOString()).split('T')[0],
          monthly_value: Number(c.monthly_value) || 0,
          scope: c.scope_description || c.services || (c.plan_name ? `Plano ${c.plan_name}` : '') || existing?.scope || '',
          service_type: [],
          account_manager: [],
          status: 'Ativo',
          notes: `Sincronizado do contrato "${c.title}".`,
        };
        if (existing) {
          await supabase.from('clients').update({
            monthly_value: payload.monthly_value,
            scope: payload.scope,
            email: payload.email,
            status: 'Ativo',
          }).eq('id', existing.id);
          updated++;
        } else {
          const { data: inserted } = await supabase.from('clients').insert(payload).select('id, company_name').single();
          if (inserted) existingMap.set(key, inserted);
          created++;
        }
      }
      await refresh();
      toast.success(`Sincronização concluída: ${created} criados, ${updated} atualizados.`);
    } catch (e: any) {
      toast.error('Erro ao sincronizar: ' + (e?.message || 'desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Excluir o cliente "${client.companyName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteClient(client.id);
      toast.success('Cliente excluído.');
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + (e?.message || 'desconhecido'));
    }
  };
  const { isAdmin } = useUserRole();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Client>>({});

  const filtered = clients.filter(c =>
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm({ serviceType: [], accountManager: [], scopeDetails: emptyScope }); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm(c); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.companyName) return;
    if (editing) {
      updateClient({ ...editing, ...form } as Client);
    } else {
      addClient({ ...form, id: crypto.randomUUID() } as Client);
    }
    setDialogOpen(false);
  };

  const toggleService = (s: ServiceType) => {
    const current = form.serviceType || [];
    setForm({ ...form, serviceType: current.includes(s) ? current.filter(x => x !== s) : [...current, s] });
  };

  const toggleManager = (name: string) => {
    const current = form.accountManager || [];
    setForm({ ...form, accountManager: current.includes(name) ? current.filter(x => x !== name) : [...current, name] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading font-semibold text-foreground">Clientes</h1>
          <p className="text-body text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          <Button onClick={syncFromContracts} variant="outline" disabled={syncing} className="gap-2 w-full sm:w-auto">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar contratos
          </Button>
          <Button onClick={openNew} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(client => (
          <motion.div
            key={client.id}
            layout
            className="card-shadow rounded-lg bg-card overflow-hidden"
          >
            <div
              className="flex cursor-pointer items-center gap-3 px-4 py-4 transition-default hover:bg-secondary/30 sm:gap-4 sm:px-5"
              onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-body font-semibold text-primary">
                {client.companyName.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{client.companyName}</p>
                <p className="text-caption text-muted-foreground truncate hidden sm:block">{client.contactName} · {client.scope}</p>
              </div>
              <div className="text-right shrink-0">
                {isAdmin && (
                  <p className="tabular-nums text-sm font-medium text-foreground sm:text-body">
                    R$ {client.monthlyValue.toLocaleString('pt-BR')}
                  </p>
                )}
                <p className={`inline-block rounded px-1.5 py-0.5 text-[10px] sm:text-caption font-medium ${statusColors[client.status]}`}>
                  {client.status}
                </p>
              </div>
              {expandedId === client.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>

            <AnimatePresence>
              {expandedId === client.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                   <div className="border-t border-border px-4 py-4 sm:px-5">
                     <Tabs defaultValue="info">
                         <TabsList className="mb-4 w-full justify-start overflow-x-auto scroller-hide">
                           <TabsTrigger value="info">Informações</TabsTrigger>
                           <TabsTrigger value="diagnostico" className="gap-1.5 flex-shrink-0">
                             <Target className="h-3.5 w-3.5" /> Diagnóstico
                           </TabsTrigger>
                           <TabsTrigger value="insights" className="gap-1.5 flex-shrink-0">
                             <BarChart3 className="h-3.5 w-3.5" /> Insights Meta
                           </TabsTrigger>
                           <TabsTrigger value="indicacoes" className="gap-1.5 flex-shrink-0">
                             <Gift className="h-3.5 w-3.5" /> Indicações
                           </TabsTrigger>
                           <TabsTrigger value="portal" className="gap-1.5 flex-shrink-0">
                             <Shield className="h-3.5 w-3.5" /> Portal do Cliente
                           </TabsTrigger>
                         </TabsList>

                       <TabsContent value="info" className="space-y-4">
                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                           <div><p className="text-caption text-muted-foreground">Email</p><p className="text-body text-foreground break-all">{client.email}</p></div>
                           <div><p className="text-caption text-muted-foreground">Telefone</p><p className="text-body text-foreground">{client.phone}</p></div>
                           <div><p className="text-caption text-muted-foreground">Início do contrato</p><p className="text-body text-foreground">{new Date(client.contractStartDate).toLocaleDateString('pt-BR')}</p></div>
                           <div><p className="text-caption text-muted-foreground">Responsável</p><p className="text-body text-foreground">{(client.accountManager || []).join(', ') || '—'}</p></div>
                         </div>

                         <div className="flex flex-wrap gap-1">
                           {client.serviceType.map(s => (
                             <span key={s} className="rounded bg-primary/10 px-2 py-0.5 text-[10px] sm:text-caption font-medium text-primary">{s}</span>
                           ))}
                         </div>

                         {client.scopeDetails && (
                           <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                             <h3 className="text-body font-semibold text-foreground">Escopo do Contrato</h3>
                             <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                               {client.scopeDetails.monthlyDeliverables.length > 0 && (
                                 <div>
                                   <p className="text-caption text-muted-foreground mb-1">Entregas mensais</p>
                                   <ul className="space-y-1">{client.scopeDetails.monthlyDeliverables.map((d, i) => <li key={i} className="text-sm sm:text-body text-foreground">• {d}</li>)}</ul>
                                 </div>
                               )}
                               {client.scopeDetails.includedServices.length > 0 && (
                                 <div>
                                   <p className="text-caption text-muted-foreground mb-1">Serviços incluídos</p>
                                   <ul className="space-y-1">{client.scopeDetails.includedServices.map((s, i) => <li key={i} className="text-sm sm:text-body text-foreground">• {s}</li>)}</ul>
                                 </div>
                               )}
                               {client.scopeDetails.demandLimits && (
                                 <div>
                                   <p className="text-caption text-muted-foreground mb-1">Limite de demandas</p>
                                   <p className="text-sm sm:text-body text-foreground">{client.scopeDetails.demandLimits}</p>
                                 </div>
                               )}
                               {client.scopeDetails.platforms.length > 0 && (
                                 <div>
                                   <p className="text-caption text-muted-foreground mb-1">Plataformas</p>
                                   <div className="flex flex-wrap gap-1">{client.scopeDetails.platforms.map(p => <span key={p} className="rounded bg-info/10 px-2 py-0.5 text-caption text-info">{p}</span>)}</div>
                                 </div>
                               )}
                             </div>
                             {client.scopeDetails.strategicNotes && (
                               <div>
                                 <p className="text-caption text-muted-foreground mb-1">Informações estratégicas</p>
                                 <p className="text-sm sm:text-body text-foreground">{client.scopeDetails.strategicNotes}</p>
                               </div>
                             )}
                           </div>
                         )}

                         {client.notes && <p className="text-caption text-muted-foreground italic">Obs: {client.notes}</p>}

                          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                           {client.phone && <WhatsAppButton phone={client.phone} name={client.contactName} size="md" />}
                           <Button size="sm" variant="outline" onClick={() => openEdit(client)} className="flex-1 sm:flex-none">Editar</Button>
                           <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-none" onClick={() => handleDelete(client)}>Excluir</Button>
                         </div>
                       </TabsContent>

                        <TabsContent value="insights">
                          <MetaInsightsPanel clientId={client.id} />
                        </TabsContent>

                        <TabsContent value="diagnostico">
                          <ClientDiagnosisTab clientId={client.id} />
                        </TabsContent>

                         <TabsContent value="indicacoes">
                           <ClientReferralsTab clientId={client.id} clientName={client.companyName} />
                         </TabsContent>

                         <TabsContent value="portal">
                           <ClientPortalTab client={client} />
                         </TabsContent>
                      </Tabs>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] sm:max-w-2xl overflow-y-auto scroller-hide">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome da empresa</Label><Input value={form.companyName || ''} onChange={e => setForm({ ...form, companyName: e.target.value })} /></div>
              <div><Label>Responsável</Label><Input value={form.contactName || ''} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Data início contrato</Label><Input type="date" value={form.contractStartDate || ''} onChange={e => setForm({ ...form, contractStartDate: e.target.value })} /></div>
              {isAdmin && (
                <div><Label>Valor mensal (R$)</Label><Input type="number" value={form.monthlyValue || ''} onChange={e => setForm({ ...form, monthlyValue: Number(e.target.value) })} /></div>
              )}
            </div>
            <div><Label>Escopo</Label><Input value={form.scope || ''} onChange={e => setForm({ ...form, scope: e.target.value })} /></div>
            <div>
              <Label>Serviços</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {serviceOptions.map(s => (
                  <button key={s} type="button" onClick={() => toggleService(s)}
                    className={`rounded-md px-3 py-1 text-caption font-medium transition-default ${(form.serviceType || []).includes(s) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável(is) pela conta</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {team.map(m => {
                    const active = (form.accountManager || []).includes(m.name);
                    return (
                      <button key={m.id} type="button" onClick={() => toggleManager(m.name)}
                        className={`rounded-md px-3 py-1 text-caption font-medium transition-default ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                      >{m.name}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status || 'Ativo'} onValueChange={v => setForm({ ...form, status: v as ClientStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            {/* Scope details */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <h3 className="text-body font-semibold text-foreground">Escopo do Contrato</h3>
              <div><Label>Entregas mensais (uma por linha)</Label><Textarea value={(form.scopeDetails?.monthlyDeliverables || []).join('\n')} onChange={e => setForm({ ...form, scopeDetails: { ...(form.scopeDetails || emptyScope), monthlyDeliverables: e.target.value.split('\n').filter(Boolean) } })} /></div>
              <div><Label>Serviços incluídos (um por linha)</Label><Textarea value={(form.scopeDetails?.includedServices || []).join('\n')} onChange={e => setForm({ ...form, scopeDetails: { ...(form.scopeDetails || emptyScope), includedServices: e.target.value.split('\n').filter(Boolean) } })} /></div>
              <div><Label>Limite de demandas</Label><Input value={form.scopeDetails?.demandLimits || ''} onChange={e => setForm({ ...form, scopeDetails: { ...(form.scopeDetails || emptyScope), demandLimits: e.target.value } })} /></div>
              <div><Label>Plataformas (uma por linha)</Label><Textarea value={(form.scopeDetails?.platforms || []).join('\n')} onChange={e => setForm({ ...form, scopeDetails: { ...(form.scopeDetails || emptyScope), platforms: e.target.value.split('\n').filter(Boolean) } })} /></div>
              <div><Label>Informações estratégicas</Label><Textarea value={form.scopeDetails?.strategicNotes || ''} onChange={e => setForm({ ...form, scopeDetails: { ...(form.scopeDetails || emptyScope), strategicNotes: e.target.value } })} /></div>
            </div>

            <Button onClick={handleSave}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientPortalTab({ client }: { client: Client }) {
  const [email, setEmail] = useState(client.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleGenerateAccess() {
    if (!email || !password) {
      toast.error('Preencha email e senha para gerar o acesso.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'client',
            client_id: client.id,
            company_name: client.companyName
          }
        }
      });

      if (error) throw error;
      toast.success('Acesso do cliente gerado com sucesso!');
      setPassword('');
    } catch (err: any) {
      toast.error('Erro ao gerar acesso: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Acesso ao Portal</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Crie ou gerencie as credenciais exclusivas para este cliente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">E-mail de Acesso</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-50" />
            <Input 
              type="email" 
              placeholder="email@cliente.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="pl-9 h-11 bg-secondary/20 border-border/40 focus:border-primary/50 transition-all rounded-xl shadow-sm"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Senha Provisória</Label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-50" />
            <Input 
              type={showPassword ? "text" : "password"}
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="pl-9 pr-10 h-11 bg-secondary/20 border-border/40 focus:border-primary/50 transition-all rounded-xl shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500">
          <Shield className="h-3 w-3" /> Atenção
        </div>
        <p className="text-xs text-amber-500/80 leading-relaxed font-medium">
          Ao gerar o acesso, o cliente receberá permissão para visualizar exclusivamente o seu próprio Portal de Conteúdo. 
          Certifique-se de salvar estas credenciais antes de fechar.
        </p>
      </div>

      <Button 
        onClick={handleGenerateAccess} 
        disabled={loading}
        className="w-full h-11 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all font-bold uppercase tracking-widest text-xs gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Liberar Acesso Estratégico
      </Button>
    </div>
  );
}

/* =========================== CLIENT REFERRALS TAB =========================== */
function ClientReferralsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [referralClient, setReferralClient] = useState<{ id: string; token: string; name: string } | null>(null);
  const [referrals, setReferrals] = useState<{ id: string; referred_name: string; referred_whatsapp: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    setLoading(true);
    const { data: rc } = await supabase
      .from('referral_clients')
      .select('id, token, name')
      .eq('client_id', clientId)
      .maybeSingle();

    if (rc) {
      setReferralClient(rc);
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, referred_name, referred_whatsapp, status, created_at')
        .eq('client_id', rc.id)
        .order('created_at', { ascending: false });
      setReferrals(refs ?? []);
    } else {
      setReferralClient(null);
      setReferrals([]);
    }
    setLoading(false);
  }

  async function createReferralClient() {
    setCreating(true);
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from('referral_clients')
      .insert({ name: clientName, token, client_id: clientId });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Programa de indicações ativado!');
    load();
  }

  const copyFormLink = () => {
    if (!referralClient) return;
    const url = `${window.location.origin}/indicar/${referralClient.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link do formulário copiado!');
  };

  const shareOnWhatsApp = () => {
    if (!referralClient) return;
    const url = `${window.location.origin}/indicar/${referralClient.token}`;
    const text = `Olá! Indique amigos para conhecer nossos serviços e ganhe prêmios exclusivos. Preencha o formulário aqui: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const statusColors: Record<string, string> = {
    enviada: 'bg-info/10 text-info',
    negociacao: 'bg-warning/10 text-warning',
    fechada: 'bg-success/10 text-success',
  };

  const statusLabels: Record<string, string> = {
    enviada: 'Enviada',
    negociacao: 'Em negociação',
    fechada: 'Fechada',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!referralClient) {
    return (
      <div className="rounded-xl border border-border bg-secondary/20 p-8 text-center space-y-4">
        <Gift className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
        <div>
          <h3 className="font-semibold text-foreground">Programa de Indicações</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ative o programa para gerar um link exclusivo que {clientName} pode compartilhar com amigos.
          </p>
        </div>
        <Button onClick={createReferralClient} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Ativar programa de indicações
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Link Card */}
      <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Link de Indicação</h3>
            <p className="text-xs text-muted-foreground">Compartilhe este link para receber leads indicados.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-background border border-border p-3">
          <code className="flex-1 text-xs text-muted-foreground truncate">{window.location.origin}/indicar/{referralClient.token}</code>
          <Button size="sm" variant="outline" onClick={copyFormLink} className="gap-1 shrink-0">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={shareOnWhatsApp} className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> Compartilhar no WhatsApp
          </Button>
          <Button size="sm" variant="secondary" asChild className="gap-1.5">
            <a href={`/indicar/${referralClient.token}`} target="_blank" rel="noreferrer">
              <Gift className="h-3.5 w-3.5" /> Abrir formulário
            </a>
          </Button>
        </div>
      </div>

      {/* Referrals List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Leads Indicados ({referrals.length})</h3>
        </div>

        {referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma indicação recebida ainda.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.referred_name}</p>
                  {r.referred_whatsapp && (
                    <p className="text-xs text-muted-foreground">{r.referred_whatsapp}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${statusColors[r.status] || 'bg-muted text-muted-foreground'}`}>
                    {statusLabels[r.status] || r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
