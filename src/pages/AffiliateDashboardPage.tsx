import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, MessageCircle, Loader2, Clock, AlertCircle, Users, Film, Play, Megaphone, TrendingUp } from 'lucide-react';
import type { Affiliate, AffiliateLead, AffiliateContract, AffiliateCommission } from '@/types/affiliates';
import logoInova from '@/assets/logo-inova.png';



const STATUS_LABEL: Record<string, string> = {
  em_analise: 'Em análise', aprovado: 'Aprovado', reprovado: 'Reprovado', suspenso: 'Suspenso',
  novo: 'Novo', em_negociacao: 'Em negociação', convertido: 'Convertido', perdido: 'Perdido',
  ativo: 'Ativo', pendente: 'Pendente', cancelado: 'Cancelado', inadimplente: 'Inadimplente',
  pago: 'Pago',
};

export default function AffiliateDashboardPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'leads';

  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [leads, setLeads] = useState<AffiliateLead[]>([]);
  const [contracts, setContracts] = useState<AffiliateContract[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    async function load() {
      // Lookup affiliate by user_id OR by email (caso o cadastro tenha sido feito anonimamente)
      let { data: a } = await supabase
        .from('affiliates' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!a && user.email) {
        const { data: byEmail } = await supabase
          .from('affiliates' as any)
          .select('*')
          .ilike('email', user.email)
          .maybeSingle();
        a = byEmail as any;
        // Link user_id para próximas consultas
        if (a && (a as any).id) {
          await supabase.from('affiliates' as any).update({ user_id: user.id }).eq('id', (a as any).id);
        }
      }
      if (!a) { if (isSubscribed) setLoading(false); return; }
      if (isSubscribed) setAffiliate(a as any);
      const affId = (a as any).id;

      const [l, c, cm, p] = await Promise.all([
        supabase.from('affiliate_leads' as any).select('*').eq('affiliate_id', affId).order('created_at', { ascending: false }),
        supabase.from('affiliate_contracts' as any).select('*').eq('affiliate_id', affId).order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions' as any).select('*').eq('affiliate_id', affId).order('created_at', { ascending: false }),
        supabase.from('portfolio_projects').select('*').order('created_at', { ascending: false }).limit(6),
      ]);

      if (isSubscribed) {
        setLeads((l.data as any) || []);
        setContracts((c.data as any) || []);
        setCommissions((cm.data as any) || []);
        setPortfolio(p.data || []);
        setLoading(false);
      }
    }

    load();

    const channel = supabase.channel('affiliate_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_contracts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_commissions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_leads' }, load)
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  function getVideoThumb(url: string) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`;
    return null;
  }

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

  const totalRevenue = paidTotal + pendingTotal;

  function getCurrentGoal(n: number) {
    if (n < 10000) return 10000;
    if (n < 100000) return 100000;
    if (n < 1000000) return 1000000;
    if (n < 10000000) return 10000000;
    if (n < 100000000) return 100000000;
    return 1000000000;
  }

  const REVENUE_GOAL = getCurrentGoal(totalRevenue);
  const revenuePct = Math.min(100, Math.round((totalRevenue / REVENUE_GOAL) * 100));

  const fmtBRL = (n: number) => {
    if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(n % 1000000 === 0 ? 1 : 2).replace('.', ',')}M`;
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2).replace('.', ',')}K`;
    return `R$ ${n.toFixed(0)}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Barra de faturamento no topo */}
      <div className="w-full rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-black p-4 md:p-5 flex items-center gap-4 shadow-lg">
        <img src={logoInova} alt="Inova" className="h-10 md:h-12 w-auto shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Faturamento</div>
              <div className="text-lg md:text-xl font-bold text-white">
                {fmtBRL(totalRevenue)} <span className="text-zinc-500 font-normal">/ {fmtBRL(REVENUE_GOAL)}</span>
              </div>
            </div>
            <div className="text-sm md:text-base font-bold text-[#BFF720]">{revenuePct}%</div>
          </div>
          <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-[#BFF720] to-[#a8de15] transition-all duration-700 rounded-full shadow-[0_0_12px_rgba(191,247,32,0.5)]"
              style={{ width: `${revenuePct}%` }}
            />
          </div>
        </div>
      </div>

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
            Entre no grupo do whatsapp de afiliados <span className="text-[#BFF720]">INOVA</span>
          </h2>
          <p className="text-zinc-300 mb-8 text-lg max-w-xl leading-relaxed">
            Receba dicas avançadas de vendas, novos materiais de divulgação, suporte prioritário e faça networking direto com a equipe da Inova.
          </p>
          <Button 
            onClick={() => window.open('https://chat.whatsapp.com/CVRk9eWDsNQ5yFYTWdiagT?mode=gi_t', '_blank')}
            className="bg-[#BFF720] text-black hover:bg-[#a8de15] font-bold text-md h-12 px-6 rounded-xl flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(191,247,32,0.2)]"
          >
            <MessageCircle className="w-5 h-5" />
            Entrar no Grupo do WhatsApp
          </Button>
        </div>
      </div>

      <div className="pt-4">
        <h1 className="text-3xl font-bold">Meu Painel de Afiliado</h1>
        <p className="text-muted-foreground">{affiliate.full_name} {affiliate.codigo_interno && <span className="font-mono text-primary">({affiliate.codigo_interno})</span>}</p>
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
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total de Leads</div><div className="text-2xl font-bold">{leads.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Contratos (Total)</div><div className="text-2xl font-bold">{contracts.length} <span className="text-sm font-normal text-muted-foreground">({contracts.filter(c => c.status === 'ativo').length} ativos)</span></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Comissões pendentes</div><div className="text-2xl font-bold text-amber-500">R$ {pendingTotal.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Comissões pagas</div><div className="text-2xl font-bold text-[#BFF720]">R$ {paidTotal.toFixed(2)}</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/afiliado/${v}`)} orientation="vertical" className="flex flex-col md:flex-row gap-6 items-start">
        {/* A barra lateral interna foi ocultada, pois agora usamos o menu geral da aplicação */}
        <TabsList className="hidden">
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="vitrine">Nossos Serviços</TabsTrigger>
        </TabsList>

        <div className="flex-1 w-full min-w-0">
          <TabsContent value="leads" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardHeader className="border-b pb-4 mb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Meus Leads</CardTitle>
              <Badge variant="secondary" className="text-sm">{leads.length} cadastrados</Badge>
            </CardHeader>
            <CardContent className="p-0">
            {leads.length === 0 ? <p className="p-6 text-muted-foreground text-center">Nenhum lead ainda.</p> : (
              <div className="divide-y">
                {leads.map(l => (
                  <div key={l.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{l.lead_name}</div>
                      <div className="text-sm text-muted-foreground">{l.whatsapp} {l.company && `• ${l.company}`}</div>
                      {l.notes?.includes('[TOKEN:') && <div className="text-xs text-muted-foreground font-mono mt-1">Código: <span className="text-primary">{l.notes.match(/\[TOKEN:(AF-\w+)\]/)?.[1] || '—'}</span></div>}
                    </div>
                    <Badge>{STATUS_LABEL[l.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contratos" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardHeader className="border-b pb-4 mb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Meus Contratos</CardTitle>
              <Badge variant="secondary" className="text-sm">{contracts.length} no total</Badge>
            </CardHeader>
            <CardContent className="p-0">
            {contracts.length === 0 ? <p className="p-6 text-muted-foreground text-center">Nenhum contrato ainda.</p> : (
              <div className="divide-y">
                {contracts.map(c => (
                  <div key={c.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">{c.client_name}</div>
                      <div className="text-sm text-zinc-400 mt-1">Cliente Inova</div>
                    </div>
                    <Badge>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardHeader className="border-b pb-4 mb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Minhas Comissões</CardTitle>
              <Badge variant="secondary" className="text-sm">{commissions.length} registros</Badge>
            </CardHeader>
            <CardContent className="p-0">
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

        <TabsContent value="info" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Regras do Programa de Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800/50">
                <h3 className="font-bold text-lg text-[#BFF720] flex items-center gap-2"><span className="bg-[#BFF720]/20 text-[#BFF720] w-6 h-6 flex items-center justify-center rounded-full text-sm">1</span> Como funciona a indicação?</h3>
                <p className="text-zinc-300 text-sm mt-3 leading-relaxed">Você possui um link exclusivo e intransferível. Sempre que um potencial cliente se cadastrar através dele, o nome aparecerá imediatamente na sua aba de "Leads". A partir desse momento, a equipe comercial da Inova assume toda a parte de apresentação, negociação e fechamento. Você só precisa indicar e acompanhar os resultados em tempo real.</p>
              </div>

              <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800/50">
                <h3 className="font-bold text-lg text-[#BFF720] flex items-center gap-2"><span className="bg-[#BFF720]/20 text-[#BFF720] w-6 h-6 flex items-center justify-center rounded-full text-sm">2</span> Estrutura de Comissionamento</h3>
                <p className="text-zinc-300 text-sm mt-3 mb-3">Nosso modelo foi desenhado para criar uma verdadeira parceria de longo prazo. Ao fecharmos um contrato com o seu lead, você ganha de duas formas:</p>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-2 ml-2">
                  <li><strong>Comissão de Fechamento:</strong> <span className="text-white font-bold bg-zinc-800 px-2 py-0.5 rounded">R$ 300,00</span> pagos de forma única assim que o cliente assina e inicia o projeto.</li>
                  <li><strong>Comissão Recorrente:</strong> <span className="text-white font-bold bg-zinc-800 px-2 py-0.5 rounded">R$ 100,00</span> pagos todos os meses, de forma contínua, enquanto o seu indicado mantiver o contrato ativo com a Inova.</li>
                </ul>
              </div>

              <div className="bg-red-500/5 p-5 rounded-xl border border-red-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-[30px] -mr-10 -mt-10" />
                <h3 className="font-bold text-lg text-red-400 flex items-center gap-2 relative z-10"><AlertCircle className="w-5 h-5" /> Regra de Inatividade (Importante)</h3>
                <p className="text-zinc-300 text-sm mt-3 leading-relaxed relative z-10">Para manter a saúde e o engajamento do programa de afiliados, exigimos uma constância mínima. Se o afiliado passar <strong>3 meses consecutivos sem registrar nenhuma nova indicação</strong> (sem entrada de novos leads), ele <strong>perderá definitivamente o direito de receber as comissões recorrentes</strong> dos contratos antigos. Mantenha seu link sempre ativo na sua rede de contatos para continuar faturando mensalmente!</p>
              </div>

              <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800/50">
                <h3 className="font-bold text-lg text-[#BFF720] flex items-center gap-2"><span className="bg-[#BFF720]/20 text-[#BFF720] w-6 h-6 flex items-center justify-center rounded-full text-sm">4</span> Prazos e Pagamentos (PIX)</h3>
                <p className="text-zinc-300 text-sm mt-3 leading-relaxed">Não trabalhamos com burocracias de saque de plataforma. Os pagamentos das suas comissões são realizados de forma direta e rápida via <strong>PIX</strong>, utilizando a chave cadastrada no seu perfil. Acompanhe a sua aba "Comissões": o que estiver verde (Pago) já está na sua conta bancária!</p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitrine" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-zinc-800/50 bg-zinc-900/30">
            <CardHeader className="border-b border-zinc-800/50 mb-6 pb-6">
              <CardTitle className="text-2xl font-bold">A Inova e o nosso Portfólio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-12 space-y-8">
                <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-black border border-zinc-800/50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#BFF720]/5 rounded-full blur-[60px] -mr-32 -mt-32 pointer-events-none" />
                  
                  <h3 className="text-xl md:text-2xl font-extrabold text-[#BFF720] mb-4">O que nós somos?</h3>
                  <p className="text-zinc-300 leading-relaxed mb-8 text-base md:text-lg max-w-4xl">
                    Somos muito mais do que uma produtora, somos uma <strong>aceleradora de marcas</strong>. A Inova une a mais alta estética cinematográfica com inteligência de mercado para posicionar empresas como líderes absolutas. Não entregamos apenas "vídeos e posts"; nós criamos narrativas visuais magnéticas, orquestrando do planejamento estratégico inicial até a execução final de altíssimo padrão. Nosso único objetivo é <strong>fazer o seu cliente vender mais</strong>, encantando a audiência dele.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-[#BFF720]/30 transition-colors group">
                      <Film className="w-8 h-8 text-[#BFF720] mb-3 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-white text-lg">Produção Audiovisual</h4>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Vídeos institucionais, comerciais e documentários com qualidade de cinema.</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-[#BFF720]/30 transition-colors group">
                      <Megaphone className="w-8 h-8 text-[#BFF720] mb-3 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-white text-lg">Social Media Estratégico</h4>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Conteúdo para redes sociais que não apenas engaja, mas converte público em cliente.</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-[#BFF720]/30 transition-colors group">
                      <TrendingUp className="w-8 h-8 text-[#BFF720] mb-3 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-white text-lg">Foco em Resultados</h4>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Não vendemos visualizações vazias. Tudo é pensado para impulsionar o faturamento das empresas.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Trabalhos Selecionados</h3>
                  <p className="text-zinc-400 text-lg">Utilize estes projetos como prova social para mostrar a qualidade da Inova aos seus leads.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolio.map(p => {
                  const thumb = p.thumbnail_url || getVideoThumb(p.video_url);
                  return (
                    <div key={p.id} className="group relative cursor-pointer overflow-hidden rounded-xl aspect-[4/5] bg-black border border-zinc-800" onClick={() => p.video_url && window.open(p.video_url, '_blank')}>
                      {thumb ? (
                        <img src={thumb} alt={p.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-zinc-900"><Film className="h-12 w-12 text-zinc-700" /></div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                      
                      {p.video_url && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#BFF720]/90 text-black opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                            <Play className="h-6 w-6 ml-1" fill="currentColor" />
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        {p.category && <span className="inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-[#BFF720]/20 text-[#BFF720] mb-2">{p.category}</span>}
                        <h3 className="text-lg font-bold text-white leading-tight">{p.title}</h3>
                        {p.description && <p className="text-xs text-white/60 mt-1 line-clamp-2">{p.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {portfolio.length === 0 && <p className="text-center text-muted-foreground p-8">Nenhum projeto no portfólio ainda.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
