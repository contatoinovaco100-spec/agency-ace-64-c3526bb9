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
import { Loader2, Check, X, Pause, RefreshCw, Plus, Copy } from 'lucide-react';
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

    // Gera comissão de fechamento ao ativar
    if (status === 'ativo' && cur) {
      await supabase.from('affiliate_commissions' as any).insert({
        affiliate_id: cur.affiliate_id, contract_id: cur.id,
        type: 'fechamento', amount: 300, status: 'pendente',
        reference_month: new Date().toISOString().slice(0, 10),
      });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Programa de Afiliados</h1>
          <p className="text-muted-foreground">Gerencie afiliados, leads, contratos e comissões.</p>
        </div>
        <Button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/afiliados/cadastro`); toast({ title: 'Link de cadastro copiado!' }); }} variant="outline">
          <Copy className="w-4 h-4 mr-2" /> Link de cadastro público
        </Button>
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">Afiliados ({affiliates.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card><CardContent className="p-0 divide-y">
            {affiliates.map(a => (
              <div key={a.id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{a.full_name} <Badge variant="outline" className="ml-2">{STATUS_LABEL[a.status]}</Badge></div>
                  <div className="text-sm text-muted-foreground">{a.email} • {a.whatsapp} • {a.city_state}</div>
                  {a.slug && <div className="text-xs text-[#BFF720] font-mono mt-1">/in/{a.slug}</div>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {a.status === 'em_analise' && (
                    <>
                      <Button size="sm" onClick={() => approve(a)} className="bg-[#BFF720] text-black hover:bg-[#a8de15]"><Check className="w-4 h-4 mr-1" /> Aprovar</Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus(a, 'reprovado')}><X className="w-4 h-4 mr-1" /> Reprovar</Button>
                    </>
                  )}
                  {a.status === 'aprovado' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(a, 'suspenso')}><Pause className="w-4 h-4 mr-1" /> Suspender</Button>
                  )}
                  {a.status === 'suspenso' && (
                    <Button size="sm" onClick={() => setStatus(a, 'aprovado')} className="bg-[#BFF720] text-black hover:bg-[#a8de15]">Reativar</Button>
                  )}
                  {a.status === 'reprovado' && (
                    <Button size="sm" variant="outline" onClick={() => approve(a)}>Aprovar agora</Button>
                  )}
                </div>
              </div>
            ))}
            {affiliates.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhum afiliado cadastrado.</p>}
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

        <TabsContent value="commissions">
          <div className="mb-4">
            <Button onClick={generateRecurring} className="bg-[#BFF720] text-black hover:bg-[#a8de15]">
              <RefreshCw className="w-4 h-4 mr-2" /> Gerar recorrência do mês (R$100 por contrato ativo)
            </Button>
          </div>
          <Card><CardContent className="p-0 divide-y">
            {commissions.map(c => (
              <div key={c.id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">R$ {Number(c.amount).toFixed(2)} <Badge variant="outline" className="ml-2">{c.type}</Badge></div>
                  <div className="text-sm text-muted-foreground">Afiliado: <strong>{affiliateName(c.affiliate_id)}</strong> • Ref: {new Date(c.reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'pago' ? 'default' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge>
                  {c.status === 'pendente' && <Button size="sm" onClick={() => markCommissionPaid(c.id)}>Marcar como pago</Button>}
                </div>
              </div>
            ))}
            {commissions.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhuma comissão ainda.</p>}
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
      status: 'ativo',
      signed_at: new Date().toISOString(),
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    // Gera comissão de fechamento R$300
    await supabase.from('affiliate_commissions' as any).insert({
      affiliate_id: lead.affiliate_id, contract_id: (contract as any).id,
      type: 'fechamento', amount: 300, status: 'pendente',
      reference_month: new Date().toISOString().slice(0, 10),
    });
    toast({ title: 'Contrato criado' });
    setOpen(false); setSaving(false); onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Contrato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Criar contrato — {lead.lead_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor mensal (R$)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Será criado como "Ativo" e a comissão de fechamento de R$300 será registrada como pendente.</p>
        </div>
        <DialogFooter><Button onClick={create} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
