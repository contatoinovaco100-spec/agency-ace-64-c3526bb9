import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Flame, Heart, MessageCircle, RefreshCw, Users, Eye, TrendingUp, Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DateComparison from '@/components/analytics/DateComparison';

interface AnalyticsData {
  profile: { username: string; name: string; picture: string; followers: number; following: number; media_count: number };
  summary: { reach: number; impressions: number; profile_views: number; views?: number; gained_followers: number; avg_reach: number; avg_engagement_rate: number; days: number };
  daily: Array<{ date: string; reach?: number; impressions?: number; profile_views?: number; views?: number; follower_count?: number }>;
  media: Array<{
    id: string; caption: string; is_reel: boolean; thumbnail: string; permalink: string;
    timestamp: string; likes: number; comments: number; saved: number; shares: number;
    plays: number; reach: number; impressions: number; engagement: number; engagement_rate: number;
  }>;
  viral?: AnalyticsData['media'];
  history?: Array<{ snapshot_date: string; followers: number; reach: number; profile_views: number }>;
  warning?: string | null;
  _debug?: { igId: string; tokenPrefix: string; windows: number; errLog: string[]; dailyCount: number; mediaCount: number };
}

const nf = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);

export default function InstagramAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { accounts, loading: loadingAccounts } = useSocialAccounts();
  const igAccounts = useMemo(
    () => accounts.filter(a => a.platform === 'instagram' && a.external_id),
    [accounts],
  );

  const [accountId, setAccountId] = useState('');
  const [days, setDays] = useState('30');
  const [comparisonDays, setComparisonDays] = useState(0);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Audit states
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [tone, setTone] = useState<'positiva' | 'negativa'>('positiva');
  const [isGeneratingAudit, setIsGeneratingAudit] = useState(false);

  useEffect(() => {
    if (!accountId && igAccounts.length) setAccountId(igAccounts[0].id);
  }, [igAccounts, accountId]);

  const fetchDays = Math.min(90, Math.max(Number(days), comparisonDays));

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('instagram-analytics', {
        body: { account_id: accountId, days: fetchDays },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AnalyticsData);
    } catch (e: any) {
      toast.error('Erro ao carregar métricas', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [accountId, fetchDays]);

  useEffect(() => { load(); }, [load]);

  const handleEarliestDate = useCallback((date: string) => {
    const needed = Math.ceil((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86400000) + 1;
    setComparisonDays(prev => (needed > prev ? Math.min(90, needed) : prev));
  }, []);


  const generateSlug = (name: string) => {
    const base = (name || 'cliente')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'cliente';
    const rand = Math.random().toString(36).substring(2, 8);
    return `${base}-${rand}`;
  };

  const handleGenerateAudit = async () => {
    if (!data) return;
    if (!clientName.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    
    setIsGeneratingAudit(true);
    const toastId = toast.loading('Analisando perfil e gerando relatório...');

    try {
      const toneInstruction = tone === 'positiva'
        ? `TOM DA MENSAGEM: POSITIVO E ENCORAJADOR. Mesmo apontando problemas, destaque oportunidades, conquistas e o potencial de crescimento. Use linguagem otimista.`
        : `TOM DA MENSAGEM: CRÍTICO E DIRETO (NEGATIVO/ALERTA). Seja franco, urgente e mostre os riscos reais. Use linguagem de alerta. Não suavize problemas.`;

      const systemPrompt = `Você é um Consultor Sênior de Social Media com foco em Instagram.
Você vai receber um JSON contendo métricas reais de um perfil do Instagram (alcance, seguidores, visitas, publicações recentes, virais, etc).
Analise os dados e gere UM ÚNICO RELATÓRIO ESTRATÉGICO COMPLETO.

\${toneInstruction}

REGRAS DE OURO:
1. Use os valores reais fornecidos no JSON.
2. Para cada métrica principal, dê o valor, uma classificação (Excelente/Boa/Média/Baixa/Crítica) e uma breve interpretação.
3. Score geral de 0-100 baseado na performance global.
4. Scores por dimensão (conteudo, engajamento, alcance, conversao) de 0-100.
5. Plano de ação: 5-7 ações com TÍTULO + DESCRIÇÃO + prioridade.
6. KPIs destaque: 3-4 indicadores principais.
7. Status válidos: "good", "warning", "bad".

Retorne APENAS JSON neste formato:
{
  "campanha": {
    "nome": "Perfil analisado",
    "plataforma": "Instagram",
    "periodo": "Últimos \${days} dias",
    "objetivo": "Crescimento e Engajamento"
  },
  "resumo": {
    "classificacao": "good" | "warning" | "bad",
    "titulo": "Boa" | "Regular" | "Ruim" | "Crítica" | "Excelente",
    "explicacao": "2-3 frases sobre o estado geral",
    "scoreGeral": 65
  },
  "kpisDestaque": [
    { "label": "Alcance", "value": "10k", "delta": "+15%", "status": "good" }
  ],
  "metricas": [
    { "name": "Engajamento", "value": "2.4%", "benchmark": "Ideal: > 3%", "classification": "Média", "status": "warning", "interpretation": "Interpretação" }
  ],
  "scores": {
    "conteudo": 60,
    "engajamento": 75,
    "alcance": 50,
    "conversao": 80
  },
  "diagnosticoEstrategico": {
    "problemaPrincipal": "Frase principal",
    "gargalo": "Conteúdo",
    "detalhe": "Detalhes",
    "pontosFortes": ["p1"],
    "pontosFracos": ["p1"]
  },
  "planoDeAcao": [
    { "titulo": "Ação", "descricao": "Desc", "prioridade": "alta" }
  ],
  "projecao": {
    "cenarioAtual": "Atual",
    "cenarioOtimizado": "Otimizado",
    "potencial": "+X%"
  },
  "alertas": [
    { "tipo": "warning", "mensagem": "Alerta" }
  ]
}
IMPORTANTE: Retorne SOMENTE o JSON válido, sem marcação markdown.`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: JSON.stringify(data),
          model: 'google/gemini-2.5-flash',
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao chamar IA');
      if (fnData?.error) throw new Error(fnData.error);

      let result: any = fnData?.result;
      if (typeof result === 'string') {
        const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleaned);
      }
      if (!result?.resumo) throw new Error('IA não retornou um relatório válido');

      const newSlug = generateSlug(clientName);
      const { error: insertError } = await supabase.from('social_audits').insert({
        user_id: user?.id ?? null,
        slug: newSlug,
        client_name: clientName.trim(),
        platform: 'instagram',
        score: result?.resumo?.scoreGeral ?? 0,
        diagnosis: result,
      });

      if (insertError) {
        console.warn('Erro ao salvar:', insertError);
        toast.error('Erro ao salvar relatório no banco de dados.', { id: toastId });
        return;
      }

      toast.success('Relatório estratégico gerado com sucesso!', { id: toastId });
      setIsAuditModalOpen(false);
      navigate(`/diagnostico-social/${newSlug}`);
      
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao gerar relatório', { id: toastId });
    } finally {
      setIsGeneratingAudit(false);
    }
  };

  const chartData = (data?.daily ?? []).map(d => ({
    date: d.date.slice(5),
    Alcance: d.reach ?? 0,
    Impressões: d.impressions ?? 0,
    Visitas: d.profile_views ?? 0,
  }));

  const kpis = [
    { label: 'Seguidores', value: nf(data?.profile.followers ?? 0), icon: Users },
    { label: 'Alcance', value: nf(data?.summary.reach ?? 0), icon: Eye },
    { label: 'Impressões', value: nf(data?.summary.impressions ?? 0), icon: BarChart3 },
    { label: 'Visitas ao perfil', value: nf(data?.summary.profile_views ?? 0), icon: TrendingUp },
    { label: 'Novos seguidores', value: nf(data?.summary.gained_followers ?? 0), icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics do Instagram</h1>
          <p className="text-sm text-muted-foreground">Crescimento, alcance e desempenho de cada publicação</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
            <SelectContent>
              {igAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading || !accountId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button onClick={() => setIsAuditModalOpen(true)} disabled={loading || !data} className="bg-primary hover:bg-primary/90">
            <Wand2 className="mr-2 h-4 w-4" /> Gerar Diagnóstico
          </Button>
        </div>
      </div>

      {!loadingAccounts && !igAccounts.length && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Nenhuma conta do Instagram conectada. Conecte em <strong>Redes Sociais</strong> para ver as métricas.
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                {loading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="text-2xl font-bold">{k.value}</p>}
              </div>
              <k.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Debug Panel - mostra erros da API */}
      {!loading && data?._debug && (data._debug.errLog.length > 0 || (data.summary.reach === 0 && data.summary.profile_views === 0)) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
              <AlertTriangle className="h-4 w-4" /> Diagnóstico de Dados
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>IG ID: <code className="bg-muted px-1 rounded">{data._debug.igId}</code></p>
              <p>Token: <code className="bg-muted px-1 rounded">{data._debug.tokenPrefix}</code></p>
              <p>Janelas de consulta: {data._debug.windows} | Posts: {data._debug.mediaCount} | Dias: {data._debug.dailyCount}</p>
              {data._debug.errLog.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-destructive">Erros da Graph API:</p>
                  <ul className="list-disc list-inside text-destructive/80">
                    {data._debug.errLog.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
              {data.summary.reach === 0 && data.summary.profile_views === 0 && data._debug.errLog.length === 0 && (
                <p className="text-amber-600">Nenhum erro retornado, mas métricas zeradas. Verifique se a conta Instagram Business tem insights habilitados.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
        <CardContent className="h-72">
          {loading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="Alcance" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                <Area type="monotone" dataKey="Impressões" stroke="hsl(var(--info))" fill="hsl(var(--info) / 0.1)" />
                <Area type="monotone" dataKey="Visitas" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <DateComparison daily={data?.daily ?? []} onEarliestDateChange={handleEarliestDate} />



      {!!data?.viral?.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-primary" /> Conteúdos virais (2x acima da média)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.viral.map(m => (
              <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer"
                 className="flex gap-3 rounded-lg border border-border p-2 transition-colors hover:border-primary/50">
                {m.thumbnail && <img src={m.thumbnail} alt="Publicação viral" className="h-16 w-16 rounded object-cover" />}
                <div className="min-w-0 text-xs">
                  <p className="line-clamp-2 font-medium">{m.caption || 'Sem legenda'}</p>
                  <p className="mt-1 text-muted-foreground">{nf(m.reach)} de alcance · {m.engagement_rate}% eng.</p>
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Publicações recentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <Skeleton className="h-40 w-full" />}
          {!loading && !data?.media?.length && (
            <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada.</p>
          )}
          {(data?.media ?? []).map(m => (
            <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer"
               className="flex items-center gap-3 rounded-lg border border-border p-2 transition-colors hover:border-primary/50">
              {m.thumbnail
                ? <img src={m.thumbnail} alt="Miniatura da publicação" className="h-12 w-12 rounded object-cover" />
                : <div className="h-12 w-12 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.caption || 'Sem legenda'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.timestamp).toLocaleDateString('pt-BR')} · {m.is_reel ? 'Reels' : 'Feed'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{nf(m.reach)}</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{nf(m.likes)}</span>
                <span className="hidden items-center gap-1 sm:flex"><MessageCircle className="h-3.5 w-3.5" />{nf(m.comments)}</span>
                <span className="hidden items-center gap-1 md:flex" title="Salvos">🔖 {nf(m.saved)}</span>
                <span className="hidden items-center gap-1 lg:flex" title="Compartilhamentos">↗ {nf(m.shares)}</span>
                <Badge variant="secondary">{m.engagement_rate}%</Badge>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>

      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerar Diagnóstico Estratégico</DialogTitle>
            <DialogDescription>
              A IA vai analisar todas as métricas do período selecionado e criar um relatório completo compartilhável.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">Nome do Cliente</label>
              <Input
                id="name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Restaurante Sabor & Arte"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tom da Mensagem</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTone('positiva')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    tone === 'positiva' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold">Positiva</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Foco em oportunidades.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTone('negativa')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    tone === 'negativa' ? 'border-red-500 bg-red-500/10' : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold">Alerta</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Foco em riscos reais.</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateAudit} disabled={isGeneratingAudit || !clientName.trim()}>
              {isGeneratingAudit ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : 'Gerar Relatório'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
