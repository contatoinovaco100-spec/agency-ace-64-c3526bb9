import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, MessageCircle, Loader2, Clock, AlertCircle, Users } from 'lucide-react';
import type { Affiliate, AffiliateLead, AffiliateContract, AffiliateCommission } from '@/types/affiliates';

const STATUS_LABEL: Record<string, string> = {
  em_analise: 'Em análise', aprovado: 'Aprovado', reprovado: 'Reprovado', suspenso: 'Suspenso',
  novo: 'Novo', em_negociacao: 'Em negociação', convertido: 'Convertido', perdido: 'Perdido',
  ativo: 'Ativo', pendente: 'Pendente', cancelado: 'Cancelado', inadimplente: 'Inadimplente',
  pago: 'Pago',
};

export default function AffiliateDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [leads, setLeads] = useState<AffiliateLead[]>([]);
  const [contracts, setContracts] = useState<AffiliateContract[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: a } = await supabase.from('affiliates' as any).select('*').eq('user_id', user.id).maybeSingle();
      if (!a) { setLoading(false); return; }
      setAffiliate(a as any);
      const [l, c, cm] = await Promise.all([
        supabase.from('affiliate_leads' as any).select('*').eq('affiliate_id', (a as any).id).order('created_at', { ascending: false }),
        supabase.from('affiliate_contracts' as any).select('*').eq('affiliate_id', (a as any).id).order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions' as any).select('*').eq('affiliate_id', (a as any).id).order('created_at', { ascending: false }),
      ]);
      setLeads((l.data as any) || []);
      setContracts((c.data as any) || []);
      setCommissions((cm.data as any) || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  if (!affiliate) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card><CardContent className="pt-8 text-center space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-bold">Nenhum cadastro de afiliado encontrado</h2>
          <p className="text-muted-foreground">Cadastre-se em <a href="/afiliados/cadastro" className="text-[#BFF720] underline">/afiliados/cadastro</a></p>
        </CardContent></Card>
      </div>
    );
  }

  if (affiliate.status !== 'aprovado') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card><CardContent className="pt-8 text-center space-y-3">
          <Clock className="w-12 h-12 mx-auto text-amber-500" />
          <h2 className="text-2xl font-bold">Cadastro {STATUS_LABEL[affiliate.status]}</h2>
          <p className="text-muted-foreground">
            {affiliate.status === 'em_analise' && 'Aguarde a aprovação do seu cadastro para acessar o painel de afiliado.'}
            {affiliate.status === 'reprovado' && 'Seu cadastro foi reprovado. Entre em contato com a Inova.'}
            {affiliate.status === 'suspenso' && 'Seu cadastro está suspenso. Entre em contato com a Inova.'}
          </p>
        </CardContent></Card>
      </div>
    );
  }

  const link = `${window.location.origin}/in/${affiliate.slug}`;
  const pendingTotal = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal = commissions.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.amount), 0);

  const copy = () => { navigator.clipboard.writeText(link); toast({ title: 'Link copiado!' }); };
  const share = () => {
    const msg = `Conheça a Inova Marketing pelo meu link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Banner / Aba no topo */}
      <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl group border border-zinc-800">
        {/* Imagem estática 1920x1080 placeholder */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1920&h=1080')" }}
        />
        {/* Overlay escuro/gradiente para leitura do texto */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        
        {/* Conteúdo do banner */}
        <div className="relative z-10 p-8 md:p-12 flex flex-col items-start justify-center min-h-[320px] max-w-3xl">
          <Badge className="bg-[#BFF720] text-black hover:bg-[#a8de15] mb-4 text-xs font-bold uppercase tracking-wider">
            Comunidade Exclusiva
          </Badge>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
            Faça parte do nosso <span className="text-[#BFF720]">Grupo VIP</span>
          </h2>
          <p className="text-zinc-300 mb-8 text-lg max-w-xl leading-relaxed">
            Receba dicas avançadas de vendas, novos materiais de divulgação, suporte prioritário e faça networking direto com a equipe da Inova.
          </p>
          <Button 
            onClick={() => window.open('https://chat.whatsapp.com/SEU_LINK_DE_CONVITE_AQUI', '_blank')}
            className="bg-[#BFF720] text-black hover:bg-[#a8de15] font-bold text-md h-12 px-6 rounded-xl flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(191,247,32,0.2)]"
          >
            <MessageCircle className="w-5 h-5" />
            Entrar no Grupo do WhatsApp
          </Button>
        </div>
      </div>

      <div className="pt-4">
        <h1 className="text-3xl font-bold">Meu Painel de Afiliado</h1>
        <p className="text-muted-foreground">{affiliate.full_name}</p>
      </div>

      <Card className="border-[#BFF720]/30">
        <CardHeader><CardTitle>Seu link único</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted p-3 rounded font-mono text-sm break-all">{link}</div>
          <div className="flex gap-2">
            <Button onClick={copy} variant="outline"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
            <Button onClick={share} className="bg-[#BFF720] text-black hover:bg-[#a8de15]"><MessageCircle className="w-4 h-4 mr-2" /> Compartilhar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Leads</div><div className="text-2xl font-bold">{leads.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Contratos ativos</div><div className="text-2xl font-bold">{contracts.filter(c => c.status === 'ativo').length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Comissões pendentes</div><div className="text-2xl font-bold text-amber-500">R$ {pendingTotal.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Comissões pagas</div><div className="text-2xl font-bold text-[#BFF720]">R$ {paidTotal.toFixed(2)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <Card><CardContent className="p-0">
            {leads.length === 0 ? <p className="p-6 text-muted-foreground text-center">Nenhum lead ainda.</p> : (
              <div className="divide-y">
                {leads.map(l => (
                  <div key={l.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{l.lead_name}</div>
                      <div className="text-sm text-muted-foreground">{l.whatsapp} {l.company && `• ${l.company}`}</div>
                    </div>
                    <Badge>{STATUS_LABEL[l.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card><CardContent className="p-0">
            {contracts.length === 0 ? <p className="p-6 text-muted-foreground text-center">Nenhum contrato ainda.</p> : (
              <div className="divide-y">
                {contracts.map(c => (
                  <div key={c.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{c.client_name}</div>
                      <div className="text-sm text-muted-foreground">R$ {Number(c.monthly_value).toFixed(2)}/mês</div>
                    </div>
                    <Badge>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card><CardContent className="p-0">
            {commissions.length === 0 ? <p className="p-6 text-muted-foreground text-center">Nenhuma comissão ainda.</p> : (
              <div className="divide-y">
                {commissions.map(c => (
                  <div key={c.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">R$ {Number(c.amount).toFixed(2)} <span className="text-xs text-muted-foreground">({c.type})</span></div>
                      <div className="text-sm text-muted-foreground">Ref: {new Date(c.reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                    </div>
                    <Badge variant={c.status === 'pago' ? 'default' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Regras do Programa de Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h3 className="font-semibold text-lg text-[#BFF720]">1. Como funciona?</h3>
                <p className="text-muted-foreground text-sm mt-1">Você compartilha seu link exclusivo e sempre que o cliente se cadastrar através dele, aparecerá na sua aba "Leads". Se a pessoa fechar um serviço contínuo com a Inova, você recebe comissões.</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[#BFF720]">2. Comissões</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                  <li><strong>R$ 300,00</strong> por cada contrato fechado (comissão de fechamento, paga apenas uma vez).</li>
                  <li><strong>R$ 100,00</strong> mensais por cada cliente que permanecer com contrato ativo (comissão recorrente).</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[#BFF720]">3. Pagamentos</h3>
                <p className="text-muted-foreground text-sm mt-1">Os pagamentos são realizados via PIX, utilizando a chave que você cadastrou. Acompanhe a aba de "Comissões" para ver seus ganhos pendentes ou já pagos.</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[#BFF720]">4. Acompanhamento</h3>
                <p className="text-muted-foreground text-sm mt-1">Fique de olho na aba "Leads" para ver o andamento das negociações. Quando o lead virar cliente, ele passa para a aba "Contratos".</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
