import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, Pause, RefreshCw, Plus, Copy, TrendingUp, Users, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { slugify } from '@/types/affiliates';
import type { Affiliate, AffiliateLead, AffiliateContract, AffiliateCommission } from '@/types/affiliates';

const STATUS_LABEL: Record<string, string> = {
  em_analise: 'Em análise', aprovado: 'Aprovado', reprovado: 'Reprovado', suspenso: 'Suspenso',
  novo: 'Novo', em_negociacao: 'Em negociação', convertido: 'Convertido', perdido: 'Perdido',
  ativo: 'Ativo', pendente: 'Pendente', cancelado: 'Cancelado', inadimplente: 'Inadimplente',
  pago: 'Pago',
};

export default function AffiliatesAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [leads, setLeads] = useState<AffiliateLead[]>([]);
  const [contracts, setContracts] = useState<AffiliateContract[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);

  const load = async () => {
    setLoading(true);
    const [a, l, c, cm] = await Promise.all([
      supabase.from('affiliates' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_leads' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_contracts' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_commissions' as any).select('*').order('created_at', { ascending: false }),
    ]);
    setAffiliates((a.data as any) || []);
    setLeads((l.data as any) || []);
    setContracts((c.data as any) || []);
    setCommissions((cm.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function ensureSlug(aff: Affiliate): Promise<string> {
    if (aff.slug) return aff.slug;
    const base = slugify(aff.full_name) || `aff-${aff.id.slice(0, 6)}`;
    let candidate = base; let n = 1;
    while (true) {
      const { data } = await supabase.from('affiliates' as any).select('id').eq('slug', candidate).maybeSingle();
      if (!data) return candidate;
      n++; candidate = `${base}-${n}`;
    }
  }

  async function approve(aff: Affiliate) {
    const slug = await ensureSlug(aff);
    const { error } = await supabase.from('affiliates' as any).update({
      status: 'aprovado', slug, approved_at: new Date().toISOString(),
    }).eq('id', aff.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Afiliado aprovado' }); load(); }
  }

  async function setStatus(aff: Affiliate, status: string) {
    const { error } = await supabase.from('affiliates' as any).update({ status }).eq('id', aff.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Status atualizado' }); load(); }
  }

  async function updateLeadStatus(id: string, status: string) {
    const upd: any = { status };
    if (status === 'convertido') upd.converted_at = new Date().toISOString();
    await supabase.from('affiliate_leads' as any).update(upd).eq('id', id);
    load();
  }

  async function updateContractStatus(id: string, status: string) {
    const cur = contracts.find(c => c.id === id);
    const upd: any = { status };
    if (status === 'cancelado') upd.cancelled_at = new Date().toISOString();
    if (status === 'ativo' && cur && !cur.signed_at) upd.signed_at = new Date().toISOString();
    await supabase.from('affiliate_contracts' as any).update(upd).eq('id', id);

    // Gera comissão de fechamento ao ativar pela PRIMEIRA VEZ
    if (status === 'ativo' && cur) {
      const { data: existing } = await supabase.from('affiliate_commissions' as any)
        .select('id').eq('contract_id', cur.id).eq('type', 'fechamento').maybeSingle();
        
      if (!existing) {
        await supabase.from('affiliate_commissions' as any).insert({
          affiliate_id: cur.affiliate_id, contract_id: cur.id,
          type: 'fechamento', amount: 300, status: 'pendente',
          reference_month: new Date().toISOString().slice(0, 10),
        });
      }
    }
    load();
  }

  async function markCommissionPaid(id: string) {
    await supabase.from('affiliate_commissions' as any).update({
      status: 'pago', paid_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }

  async function generateRecurring() {
    const { data, error } = await supabase.rpc('generate_monthly_affiliate_commissions' as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${data || 0} comissões geradas` }); load(); }
  }

  const affiliateName = (id: string) => affiliates.find(a => a.id === id)?.full_name || '—';

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  // Calculate Metrics
  const approvedAffiliatesCount = affiliates.filter(a => a.status === 'aprovado').length;
  const totalMRR = contracts.filter(c => c.status === 'ativo').reduce((acc, curr) => acc + Number(curr.monthly_value || 0), 0);
  const pendingCommissions = commissions.filter(c => c.status === 'pendente').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const paidCommissions = commissions.filter(c => c.status === 'pago').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Gestão de Afiliados</h1>
          <p className="text-muted-foreground mt-1">Visão geral do programa de parcerias, aprovações e comissionamento.</p>
        </div>
        <Button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/afiliados/cadastro`); toast({ title: 'Link copiado!' }); }} className="bg-[#BFF720] text-black hover:bg-[#a8de15] font-medium shadow-sm transition-all hover:shadow-[#BFF720]/20 hover:shadow-lg">
          <Copy className="w-4 h-4 mr-2" /> Copiar Link de Cadastro
        </Button>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Afiliados Ativos</p>
              <Users className="w-4 h-4 text-[#BFF720]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-white">{approvedAffiliatesCount}</h2>
              <span className="text-xs text-zinc-500">de {affiliates.length} totais</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-900/60 transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#BFF720]/5 rounded-full blur-[40px] -mr-10 -mt-10" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">MRR dos Afiliados</p>
              <TrendingUp className="w-4 h-4 text-[#BFF720]" />
            </div>
            <div className="mt-2">
              <h2 className="text-3xl font-bold text-white">R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-amber-500/20 hover:bg-zinc-900/60 transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] -mr-10 -mt-10" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Comissões Pendentes</p>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <h2 className="text-3xl font-bold text-amber-400">R$ {pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Total Pago</p>
              <DollarSign className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2">
              <h2 className="text-3xl font-bold text-white">R$ {paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="affiliates" className="w-full">
        <TabsList className="bg-zinc-900/50 border border-zinc-800 p-1 rounded-xl mb-6">
          <TabsTrigger value="affiliates" className="rounded-lg data-[state=active]:bg-zinc-800">Afiliados ({affiliates.length})</TabsTrigger>
          <TabsTrigger value="leads" className="rounded-lg data-[state=active]:bg-zinc-800">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg data-[state=active]:bg-zinc-800">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg data-[state=active]:bg-zinc-800">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm"><CardContent className="p-0 divide-y divide-zinc-800/50">
            {affiliates.map(a => (
              <div key={a.id} className="p-5 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 transition-colors hover:bg-zinc-900/50">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-lg text-white">{a.full_name}</span>
                    <Badge variant="outline" className={`${a.status === 'em_analise' ? 'border-amber-500/30 text-amber-500' : a.status === 'aprovado' ? 'border-[#BFF720]/30 text-[#BFF720]' : ''}`}>
                      {STATUS_LABEL[a.status]}
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-400 mt-2 space-y-1">
                    <p><strong className="text-zinc-300">Email:</strong> {a.email} &bull; <strong className="text-zinc-300">WhatsApp:</strong> {a.whatsapp} &bull; <strong className="text-zinc-300">Cidade/UF:</strong> {a.city_state}</p>
                    <p><strong className="text-zinc-300">CPF/CNPJ:</strong> {a.cpf_cnpj} &bull; <strong className="text-zinc-300">PIX:</strong> <span className="text-white font-mono bg-zinc-800 px-1 py-0.5 rounded">{a.pix_key || 'Não informado'}</span> &bull; <strong className="text-zinc-300">Instagram:</strong> {a.instagram}</p>
                    <p><strong className="text-zinc-300">Como conheceu:</strong> {a.how_found || 'Não informado'} &bull; <strong className="text-zinc-300">Exp. Vendas:</strong> {a.sales_experience ? 'Sim' : 'Não'}</p>
                  </div>
                  {a.slug && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="text-xs text-[#BFF720] font-mono bg-[#BFF720]/10 px-2 py-1 rounded-md">/in/{a.slug}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {a.status === 'em_analise' && (
                    <>
                      <Button size="sm" onClick={() => approve(a)} className="bg-[#BFF720] text-black hover:bg-[#a8de15] font-semibold"><Check className="w-4 h-4 mr-1" /> Aprovar</Button>
                      <Button size="sm" variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border-none" onClick={() => setStatus(a, 'reprovado')}><X className="w-4 h-4 mr-1" /> Reprovar</Button>
                    </>
                  )}
                  {a.status === 'aprovado' && (
                    <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800" onClick={() => setStatus(a, 'suspenso')}><Pause className="w-4 h-4 mr-1" /> Suspender</Button>
                  )}
                  {a.status === 'suspenso' && (
                    <Button size="sm" onClick={() => setStatus(a, 'aprovado')} className="bg-[#BFF720] text-black hover:bg-[#a8de15]">Reativar</Button>
                  )}
                  {a.status === 'reprovado' && (
                    <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800" onClick={() => approve(a)}>Aprovar agora</Button>
                  )}
                </div>
              </div>
            ))}
            {affiliates.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center">
                <AlertCircle className="w-10 h-10 text-zinc-600 mb-3" />
                <p className="text-zinc-400 font-medium">Nenhum afiliado cadastrado no momento.</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card><CardContent className="p-0 divide-y">
            {leads.map(l => (
              <div key={l.id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{l.lead_name}</div>
                  <div className="text-sm text-muted-foreground">{l.whatsapp} {l.company && `• ${l.company}`} {l.email && `• ${l.email}`}</div>
                  <div className="text-xs text-muted-foreground mt-1">Afiliado: <strong>{affiliateName(l.affiliate_id)}</strong> • {new Date(l.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={l.status} onValueChange={v => updateLeadStatus(l.id, v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_negociacao">Em negociação</SelectItem>
                      <SelectItem value="convertido">Convertido</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                  {l.status === 'convertido' && <ContractDialog lead={l} onCreated={load} />}
                </div>
              </div>
            ))}
            {leads.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhum lead ainda.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card><CardContent className="p-0 divide-y">
            {contracts.map(c => (
              <div key={c.id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{c.client_name}</div>
                  <div className="text-sm text-muted-foreground">R$ {Number(c.monthly_value).toFixed(2)}/mês • Afiliado: <strong>{affiliateName(c.affiliate_id)}</strong></div>
                </div>
                <Select value={c.status} onValueChange={v => updateContractStatus(c.id, v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {contracts.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhum contrato. Marque um lead como "convertido" para criar.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Geração de Comissões</h3>
              <p className="text-sm text-zinc-400">Calcule as comissões recorrentes do mês atual (R$ 100 por contrato ativo).</p>
            </div>
            <Button onClick={generateRecurring} className="bg-[#BFF720] text-black hover:bg-[#a8de15] shadow-[0_0_15px_rgba(191,247,32,0.15)]">
              <RefreshCw className="w-4 h-4 mr-2" /> Rodar Recorrência do Mês
            </Button>
          </div>
          <Card className="border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm"><CardContent className="p-0 divide-y divide-zinc-800/50">
            {commissions.map(c => (
              <div key={c.id} className="p-5 flex flex-wrap justify-between items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg text-white">R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300">{c.type}</Badge>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Afiliado: <strong className="text-white">{affiliateName(c.affiliate_id)}</strong> &bull; Ref: {new Date(c.reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`${c.status === 'pago' ? 'bg-[#BFF720]/20 text-[#BFF720] border-none' : 'bg-amber-500/20 text-amber-500 border-none'}`}>
                    {STATUS_LABEL[c.status]}
                  </Badge>
                  {c.status === 'pendente' && <Button size="sm" variant="outline" className="border-[#BFF720]/50 text-[#BFF720] hover:bg-[#BFF720]/10" onClick={() => markCommissionPaid(c.id)}>Marcar como pago</Button>}
                </div>
              </div>
            ))}
            {commissions.length === 0 && <p className="p-12 text-center text-muted-foreground">Nenhuma comissão ainda.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContractDialog({ lead, onCreated }: { lead: AffiliateLead; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('997');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function create() {
    setSaving(true);
    const { data: contract, error } = await supabase.from('affiliate_contracts' as any).insert({
      affiliate_id: lead.affiliate_id,
      lead_id: lead.id,
      client_name: lead.lead_name,
      monthly_value: Number(value),
      status: 'pendente',
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    
    toast({ title: 'Contrato criado como pendente' });
    setOpen(false); setSaving(false); onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Contrato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Criar contrato — {lead.lead_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor mensal (R$)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Será criado como "Pendente". A comissão de R$300 só será gerada quando você mudar o status para "Ativo".</p>
        </div>
        <DialogFooter><Button onClick={create} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
