import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
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
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, Check, X, Pause, RefreshCw, Plus, Copy, TrendingUp, Users, DollarSign, Clock, AlertCircle, Trash2, FileText, Gift, Award, CheckCircle2, Settings } from 'lucide-react';
import { slugify } from '@/types/affiliates';
import type { Affiliate, AffiliateLead, AffiliateContract, AffiliateCommission } from '@/types/affiliates';

const STATUS_LABEL: Record<string, string> = {
  em_analise: 'Em análise', aprovado: 'Aprovado', reprovado: 'Reprovado', suspenso: 'Suspenso',
  novo: 'Novo', em_negociacao: 'Em negociação', convertido: 'Convertido', perdido: 'Perdido',
  ativo: 'Ativo', pendente: 'Pendente', cancelado: 'Cancelado', inadimplente: 'Inadimplente',
  pago: 'Pago',
};

const STATUS_COLORS: Record<string, string> = {
  aprovado: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  em_analise: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  reprovado: 'bg-destructive/15 text-destructive border-destructive/30',
  suspenso: 'bg-muted text-muted-foreground border-border',
  ativo: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pendente: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  cancelado: 'bg-destructive/15 text-destructive border-destructive/30',
  inadimplente: 'bg-destructive/20 text-destructive border-destructive/40',
  convertido: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  em_negociacao: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30',
  novo: 'bg-primary/15 text-primary border-primary/30',
  perdido: 'bg-destructive/15 text-destructive border-destructive/30',
  pago: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
};

export default function AffiliatesAdminPage() {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [leads, setLeads] = useState<AffiliateLead[]>([]);
  const [contracts, setContracts] = useState<AffiliateContract[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [pageSettings, setPageSettings] = useState({ whatsappNumber: '5588994463203', vslVideoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
  const [savingSettings, setSavingSettings] = useState(false);

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

    // Carrega configurações da página de captação
    let loadedCfg = { whatsappNumber: '5588994463203', vslVideoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' };
    try {
      const { data: cfg } = await supabase.from('affiliate_settings' as any).select('*').limit(1).maybeSingle();
      if (cfg) {
        const c = cfg as any;
        loadedCfg = { whatsappNumber: c.whatsapp_number || '5588994463203', vslVideoUrl: c.vsl_video_url || 'https://www.youtube.com/embed/dQw4w9WgXcQ' };
      } else {
        const saved = localStorage.getItem('affiliate_page_settings');
        if (saved) { try { loadedCfg = JSON.parse(saved); } catch {} }
      }
    } catch (err) {
      const saved = localStorage.getItem('affiliate_page_settings');
      if (saved) { try { loadedCfg = JSON.parse(saved); } catch {} }
    }
    setPageSettings(loadedCfg);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function savePageSettings() {
    setSavingSettings(true);
    localStorage.setItem('affiliate_page_settings', JSON.stringify(pageSettings));
    try {
      const { data: existing, error: selectErr } = await supabase.from('affiliate_settings' as any).select('id').limit(1).maybeSingle();
      if (!selectErr) {
        if (existing) {
          await supabase.from('affiliate_settings' as any).update({
            whatsapp_number: pageSettings.whatsappNumber,
            vsl_video_url: pageSettings.vslVideoUrl,
            updated_at: new Date().toISOString()
          }).eq('id', (existing as any).id);
        } else {
          await supabase.from('affiliate_settings' as any).insert({
            whatsapp_number: pageSettings.whatsappNumber,
            vsl_video_url: pageSettings.vslVideoUrl
          });
        }
      }
      toast({ title: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Configurações salvas no cache local!', description: 'As alterações já estão ativas para os leads.' });
    } finally {
      setSavingSettings(false);
    }
  }

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
    else { toast({ title: 'Afiliado aprovado com sucesso!' }); load(); }
  }

  async function setStatus(aff: Affiliate, status: string) {
    const { error } = await supabase.from('affiliates' as any).update({ status }).eq('id', aff.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Status do afiliado atualizado' }); load(); }
  }

  async function updateLeadStatus(id: string, status: string) {
    const upd: any = { status };
    if (status === 'convertido') upd.converted_at = new Date().toISOString();
    await supabase.from('affiliate_leads' as any).update(upd).eq('id', id);
    toast({ title: 'Status do lead atualizado' });
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
    toast({ title: 'Status do contrato atualizado' });
    load();
  }

  async function markCommissionPaid(id: string) {
    await supabase.from('affiliate_commissions' as any).update({
      status: 'pago', paid_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: 'Comissão marcada como paga!' });
    load();
  }

  async function generateRecurring() {
    const { data, error } = await supabase.rpc('generate_monthly_affiliate_commissions' as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${data || 0} comissões recorrentes geradas com sucesso!` }); load(); }
  }

  // ==== EXCLUSÕES ====
  async function deleteContract(id: string) {
    if (!confirm('Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('affiliate_contracts' as any).delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Contrato excluído com sucesso' }); load(); }
  }

  async function deleteLead(id: string) {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
    const { error } = await supabase.from('affiliate_leads' as any).delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Lead excluído com sucesso' }); load(); }
  }

  async function deleteCommission(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta comissão?')) return;
    const { error } = await supabase.from('affiliate_commissions' as any).delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Comissão excluída com sucesso' }); load(); }
  }

  async function deleteAffiliate(id: string) {
    if (!confirm('Tem certeza que deseja excluir este afiliado e todos os seus dados?')) return;
    const { error } = await supabase.from('affiliates' as any).delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Afiliado excluído com sucesso' }); load(); }
  }

  const affiliateName = (id: string) => affiliates.find(a => a.id === id)?.full_name || 'Afiliado desconhecido';

  if (roleLoading || loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  // Calculate Metrics
  const approvedAffiliatesCount = affiliates.filter(a => a.status === 'aprovado').length;
  const totalMRR = contracts.filter(c => c.status === 'ativo').reduce((acc, curr) => acc + Number(curr.monthly_value || 0), 0);
  const pendingCommissions = commissions.filter(c => c.status === 'pendente').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const paidCommissions = commissions.filter(c => c.status === 'pago').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="space-y-8 relative pb-12">
      {/* Futuristic ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/[0.08] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-[hsl(var(--success))]/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-[hsl(var(--info))]/10 blur-[100px]" />
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(73,93%,55%,0.1),_transparent_60%)]" />
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/30 shadow-[0_0_20px_hsl(73,93%,55%/0.2)]">
              <Gift className="h-7 w-7 text-primary" />
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase tracking-wider font-bold">
                  Painel de Controle
                </Badge>
                <span className="text-xs text-muted-foreground">· Gestão Exclusiva</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Programa de <span className="text-primary">Afiliados</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Aprove parceiros, gerencie leads indicados, monitore contratos ativos e processe comissões de fechamento e recorrência.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/afiliados/cadastro`); toast({ title: 'Link de cadastro copiado com sucesso!' }); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 py-6 rounded-xl shadow-[0_0_25px_hsl(73,93%,55%/0.3)] transition-all hover:scale-105 flex items-center gap-2 self-start sm:self-center"
          >
            <Copy className="w-5 h-5" />
            Copiar Link de Cadastro
          </Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Afiliados Aprovados', value: `${approvedAffiliatesCount} / ${affiliates.length}`, icon: Users, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', glow: 'hsl(73,93%,55%)' },
          { label: 'MRR dos Afiliados', value: `R$ ${totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10', border: 'border-[hsl(var(--success))]/20', glow: 'hsl(var(--success))' },
          { label: 'Comissões Pendentes', value: `R$ ${pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Clock, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10', border: 'border-[hsl(var(--warning))]/20', glow: 'hsl(var(--warning))' },
          { label: 'Comissões Pagas', value: `R$ ${paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10', border: 'border-[hsl(var(--info))]/20', glow: 'hsl(var(--info))' },
        ].map((kpi, i) => (
          <Card key={kpi.label} className={`group relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/30 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-5px_hsl(73,93%,55%/0.15)]`}>
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-15 transition-opacity duration-500 group-hover:opacity-30" style={{ background: kpi.glow }} />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg} ring-1 ring-white/5`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <p className="mt-4 text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground tracking-tight">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="contracts" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-card/60 backdrop-blur-xl border border-border/50 p-1.5 rounded-xl gap-1">
          <TabsTrigger value="contracts" className="rounded-lg py-2.5 font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_20px_hsl(73,93%,55%/0.2)] transition-all">
            Contratos ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="leads" className="rounded-lg py-2.5 font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_20px_hsl(73,93%,55%/0.2)] transition-all">
            Leads ({leads.length})
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="rounded-lg py-2.5 font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_20px_hsl(73,93%,55%/0.2)] transition-all">
            Afiliados ({affiliates.length})
          </TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg py-2.5 font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_20px_hsl(73,93%,55%/0.2)] transition-all">
            Comissões
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg py-2.5 font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_20px_hsl(73,93%,55%/0.2)] transition-all flex items-center justify-center gap-1.5">
            <Settings className="w-4 h-4" /> Configs da Página
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA CONTRATOS ============ */}
        <TabsContent value="contracts" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-primary" /> Contratos de Afiliados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/40">
              {contracts.map(c => (
                <div key={c.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-secondary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-bold text-lg text-foreground tracking-tight">{c.client_name}</h3>
                      <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] || 'bg-secondary text-foreground'}`}>
                        {STATUS_LABEL[c.status] || c.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <DollarSign className="w-4 h-4 text-[hsl(var(--success))]" /> R$ {Number(c.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </span>
                      <span>Afiliado: <strong className="text-foreground">{affiliateName(c.affiliate_id)}</strong></span>
                      {c.signed_at && <span>Ativado em: {new Date(c.signed_at).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Select value={c.status} onValueChange={v => updateContractStatus(c.id, v)}>
                      <SelectTrigger className="w-[160px] bg-background/50 border-border/60 focus:ring-primary">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inadimplente">Inadimplente</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteContract(c.id)}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir contrato"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {contracts.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center">
                  <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium text-base">Nenhum contrato cadastrado ainda.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Quando você marcar um lead como "Convertido", poderá criar o contrato dele.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA LEADS ============ */}
        <TabsContent value="leads" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Users className="w-5 h-5 text-primary" /> Leads Indicados pelos Afiliados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/40">
              {leads.map(l => (
                <div key={l.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-secondary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-bold text-lg text-foreground tracking-tight">{l.lead_name}</h3>
                      <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[l.status] || 'bg-secondary text-foreground'}`}>
                        {STATUS_LABEL[l.status] || l.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {l.whatsapp && <span>WhatsApp: <strong className="text-foreground">{l.whatsapp}</strong></span>}
                      {l.company && <span>Empresa: <strong className="text-foreground">{l.company}</strong></span>}
                      {l.email && <span>Email: <strong className="text-foreground">{l.email}</strong></span>}
                      <span>Afiliado: <strong className="text-foreground">{affiliateName(l.affiliate_id)}</strong></span>
                      <span>Data: {new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
                      {l.token && <span>Token: <strong className="text-foreground font-mono">{l.token}</strong></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Select value={l.status} onValueChange={v => updateLeadStatus(l.id, v)}>
                      <SelectTrigger className="w-[160px] bg-background/50 border-border/60 focus:ring-primary">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_negociacao">Em negociação</SelectItem>
                        <SelectItem value="convertido">Convertido</SelectItem>
                        <SelectItem value="perdido">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                    {l.status === 'convertido' && <ContractDialog lead={l} onCreated={load} />}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteLead(l.id)}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir lead"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {leads.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center">
                  <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium text-base">Nenhum lead indicado ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA AFILIADOS ============ */}
        <TabsContent value="affiliates" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Award className="w-5 h-5 text-primary" /> Parceiros Cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/40">
              {affiliates.map(a => (
                <div key={a.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 group hover:bg-secondary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl text-foreground tracking-tight">{a.full_name}</h3>
                      <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[a.status] || 'bg-secondary text-foreground'}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <p><strong className="text-foreground">Email:</strong> {a.email}</p>
                      <p><strong className="text-foreground">WhatsApp:</strong> {a.whatsapp}</p>
                      <p><strong className="text-foreground">Cidade/UF:</strong> {a.city_state}</p>
                      <p><strong className="text-foreground">CPF/CNPJ:</strong> {a.cpf_cnpj}</p>
                      <p><strong className="text-foreground">PIX:</strong> <span className="text-foreground font-mono bg-secondary/60 px-1.5 py-0.5 rounded border border-border/50">{a.pix_key || 'Não informado'}</span></p>
                      <p><strong className="text-foreground">Instagram:</strong> {a.instagram}</p>
                      <p><strong className="text-foreground">Como conheceu:</strong> {a.how_found || 'Não informado'}</p>
                      <p><strong className="text-foreground">Exp. Vendas:</strong> {a.sales_experience ? 'Sim' : 'Não'}</p>

                    </div>
                    {a.slug && (
                      <div className="mt-4 flex items-center gap-2">
                        <div className="text-xs text-primary font-mono bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_hsl(73,93%,55%/0.15)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          /in/{a.slug}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {a.status === 'em_analise' && (
                      <>
                        <Button size="sm" onClick={() => approve(a)} className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white font-bold shadow-[0_0_20px_hsl(var(--success)/0.3)] gap-1.5">
                          <Check className="w-4 h-4" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setStatus(a, 'reprovado')} className="gap-1.5">
                          <X className="w-4 h-4" /> Reprovar
                        </Button>
                      </>
                    )}
                    {a.status === 'aprovado' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(a, 'suspenso')} className="border-border hover:bg-secondary/50 gap-1.5">
                        <Pause className="w-4 h-4" /> Suspender
                      </Button>
                    )}
                    {a.status === 'suspenso' && (
                      <Button size="sm" onClick={() => setStatus(a, 'aprovado')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5">
                        <Check className="w-4 h-4" /> Reativar
                      </Button>
                    )}
                    {a.status === 'reprovado' && (
                      <Button size="sm" variant="outline" onClick={() => approve(a)} className="border-border hover:bg-secondary/50 gap-1.5">
                        <Check className="w-4 h-4" /> Aprovar agora
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAffiliate(a.id)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir afiliado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {affiliates.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium text-base">Nenhum afiliado cadastrado no momento.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA COMISSÕES ============ */}
        <TabsContent value="commissions" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-card via-card to-card/40 p-6 rounded-2xl border border-border/50 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary animate-spin-slow" /> Geração Automática de Comissões Recorrentes
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                O sistema calcula e gera automaticamente as comissões mensais (R$ 100,00 por cada contrato ativo) para todos os afiliados com base no mês atual.
              </p>
            </div>
            <Button
              onClick={generateRecurring}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 py-6 rounded-xl shadow-[0_0_25px_hsl(73,93%,55%/0.3)] transition-all hover:scale-105 flex items-center gap-2 self-start md:self-center shrink-0"
            >
              <RefreshCw className="w-5 h-5" />
              Rodar Recorrência do Mês
            </Button>
          </div>

          <Card className="border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <DollarSign className="w-5 h-5 text-primary" /> Histórico de Comissões
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/40">
              {commissions.map(c => (
                <div key={c.id} className="p-6 flex flex-wrap items-center justify-between gap-4 group hover:bg-secondary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-extrabold text-xl text-foreground tabular-nums tracking-tight">
                        R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className="bg-secondary/60 border-border text-foreground text-xs uppercase font-semibold">
                        {c.type}
                      </Badge>
                      <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] || 'bg-secondary text-foreground'}`}>
                        {STATUS_LABEL[c.status] || c.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Afiliado: <strong className="text-foreground">{affiliateName(c.affiliate_id)}</strong></span>
                      <span>Mês de Referência: <strong className="text-foreground">{new Date(c.reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong></span>
                      {c.paid_at && <span>Pago em: {new Date(c.paid_at).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.status === 'pendente' && (
                      <Button
                        size="sm"
                        onClick={() => markCommissionPaid(c.id)}
                        className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white font-bold shadow-[0_0_20px_hsl(var(--success)/0.3)] gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Marcar como pago
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCommission(c.id)}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir comissão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {commissions.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center">
                  <DollarSign className="w-12 h-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium text-base">Nenhuma comissão gerada ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA CONFIGURAÇÕES DA PÁGINA ============ */}
        <TabsContent value="settings" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl max-w-3xl mx-auto">
            <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-5">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Settings className="w-5 h-5 text-primary" /> Configurações da Página de Captação dos Afiliados
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Altere aqui o número de WhatsApp que receberá os leads e o link do vídeo VSL exibido no topo da página exclusiva de cada afiliado (ex: /in/nome).
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Número do WhatsApp da Inova</Label>
                <Input 
                  value={pageSettings.whatsappNumber} 
                  onChange={e => setPageSettings({ ...pageSettings, whatsappNumber: e.target.value })}
                  placeholder="5588994463203" 
                  className="bg-background/50 border-border/60 focus:ring-primary h-11 text-base font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o número completo com código do país (55) e DDD, sem espaços ou símbolos. Ex: <strong className="text-foreground font-mono">5588994463203</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">URL do Vídeo VSL (Wistia, YouTube, Vimeo, PandaVideo)</Label>
                <Input 
                  value={pageSettings.vslVideoUrl} 
                  onChange={e => setPageSettings({ ...pageSettings, vslVideoUrl: e.target.value })}
                  placeholder="https://fast.wistia.net/embed/iframe/..." 
                  className="bg-background/50 border-border/60 focus:ring-primary h-11 text-base font-mono"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cole o link de embed direto do vídeo. Para o Wistia, use o formato <strong className="text-foreground font-mono">https://fast.wistia.net/embed/iframe/SEU_CODIGO</strong>. Para o YouTube, use <strong className="text-foreground font-mono">https://www.youtube.com/embed/SEU_CODIGO</strong>.
                </p>
              </div>

              <div className="pt-4 border-t border-border/40 flex justify-end">
                <Button 
                  onClick={savePageSettings} 
                  disabled={savingSettings}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 h-12 rounded-xl shadow-[0_0_20px_hsl(73,93%,55%/0.3)] transition-all hover:scale-105 flex items-center gap-2"
                >
                  {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Salvar Configurações</>}
                </Button>
              </div>
            </CardContent>
          </Card>
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
    
    toast({ title: 'Contrato criado com sucesso como Pendente!' });
    setOpen(false); setSaving(false); onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-1.5 shadow-[0_0_15px_hsl(73,93%,55%/0.25)]">
          <Plus className="w-4 h-4" /> Criar Contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border/60 bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Criar contrato — {lead.lead_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Valor mensal (R$)</Label>
            <Input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="bg-background/50 border-border/60 focus:ring-primary h-11 text-lg font-bold"
            />
          </div>
          <div className="bg-secondary/40 border border-border/50 p-4 rounded-xl space-y-1">
            <p className="text-xs font-semibold text-primary">Informação importante:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O contrato será criado com o status inicial de <strong className="text-foreground">"Pendente"</strong>. A comissão de fechamento de R$ 300,00 para o afiliado só será gerada no momento em que você alterar o status para <strong className="text-foreground">"Ativo"</strong>.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={create}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11 shadow-[0_0_20px_hsl(73,93%,55%/0.3)]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar e Criar Contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
