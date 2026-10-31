import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Bookmark, ExternalLink, Flame, Heart, MessageCircle, RefreshCw, Users, Eye, TrendingUp, Wand2, Loader2, AlertTriangle, Share2, Play, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DateComparison from '@/components/analytics/DateComparison';
import { PageHeader } from '@/components/PageHeader';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recentes' | 'alcance' | 'engajamento'>('recentes');

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
    setLoadError(null);
    try {
      const { data: res, error } = await supabase.functions.invoke('instagram-analytics', {
        body: { account_id: accountId, days: fetchDays },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AnalyticsData);
    } catch (e: any) {
      setLoadError(e?.message || 'Não foi possível carregar as métricas.');
      toast.error('Erro ao carregar métricas', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [accountId, fetchDays]);

  useEffect(() => { load(); }, [load]);

  // Trocar de conta não pode mostrar os números da conta anterior enquanto carrega
  useEffect(() => { setData(null); }, [accountId]);

  // O diagnóstico já abre com o nome do perfil
  useEffect(() => {
    if (isAuditModalOpen && !clientName && data?.profile) setClientName(data.profile.name || data.profile.username);
  }, [isAuditModalOpen, clientName, data?.profile]);

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

${toneInstruction}

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
    "periodo": "Últimos ${days} dias",
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

  const chartData = (data?.daily ?? [])
    .filter(d => d.date <= new Date().toISOString().slice(0, 10))
    .map(d => ({
      date: new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      Alcance: d.reach ?? 0,
      'Novos seguidores': d.follower_count ?? 0,
    }));

  const hasChartData = chartData.some(d => d.Alcance > 0 || d['Novos seguidores'] > 0);
  const account = igAccounts.find(a => a.id === accountId);

  const secondary = [
    { label: 'Visualizações', value: data?.summary.views ?? 0, icon: Play },
    { label: 'Visitas ao perfil', value: data?.summary.profile_views ?? 0, icon: TrendingUp },
    { label: 'Novos seguidores', value: data?.summary.gained_followers ?? 0, icon: Users, signed: true },
    { label: 'Engajamento médio', value: data?.summary.avg_engagement_rate ?? 0, icon: Heart, pct: true },
  ];

  const media = useMemo(() => {
    const list = [...(data?.media ?? [])];
    if (sortBy === 'alcance') list.sort((a, b) => b.reach - a.reach);
    else if (sortBy === 'engajamento') list.sort((a, b) => b.engagement_rate - a.engagement_rate);
    else list.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return list;
  }, [data?.media, sortBy]);

  const best = useMemo(
    () => [...(data?.media ?? [])].sort((a, b) => b.engagement - a.engagement).slice(0, 3),
    [data?.media],
  );
  const viralIds = new Set((data?.viral ?? []).map(m => m.id));

  const fmtValue = (k: (typeof secondary)[number]) =>
    k.pct ? `${String(k.value).replace('.', ',')}%` : `${k.signed && k.value > 0 ? '+' : ''}${nf(k.value)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Instagram"
        title="Relatório do cliente"
        description="Crescimento, alcance e desempenho de cada publicação."
        actions={
          <>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {igAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Período">
              {['7', '30', '90'].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    'h-8 rounded px-3 text-xs font-medium transition-colors',
                    days === d ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {d} dias
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={load} disabled={loading || !accountId} title="Atualizar" aria-label="Atualizar">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button onClick={() => setIsAuditModalOpen(true)} disabled={loading || !data}>
              <Wand2 className="h-4 w-4" /> Gerar diagnóstico
            </Button>
          </>
        }
      />

      {!loadingAccounts && !igAccounts.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Instagram className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma conta do Instagram conectada</p>
              <p className="text-sm text-muted-foreground">Conecte o perfil do cliente para ver as métricas aqui.</p>
            </div>
            <Button asChild variant="outline"><Link to="/redes-sociais">Conectar em Redes Sociais</Link></Button>
          </CardContent>
        </Card>
      )}

      {loadError && !loading && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="flex-1">Não foi possível carregar as métricas: {loadError}</span>
            <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
          </CardContent>
        </Card>
      )}

      {!!igAccounts.length && (
        <>
          {/* Perfil + números principais */}
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardContent className="flex h-full flex-col gap-5 p-5">
                <div className="flex items-center gap-4">
                  {data?.profile.picture
                    ? <img src={data.profile.picture} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30" />
                    : <div className="h-16 w-16 rounded-full bg-muted" />}
                  <div className="min-w-0 flex-1">
                    {loading && !data ? <Skeleton className="h-6 w-40" /> : (
                      <p className="truncate font-display text-lg font-semibold leading-tight">
                        {data?.profile.name || data?.profile.username || (account ? `@${account.username}` : '')}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">@{data?.profile.username ?? account?.username}</p>
                  </div>
                  {data?.profile.username && (
                    <Button asChild variant="ghost" size="icon" title="Abrir no Instagram">
                      <a href={`https://www.instagram.com/${data.profile.username}/`} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-3 divide-x divide-border rounded-lg bg-muted/50 py-3 text-center">
                  {[
                    ['Seguidores', data?.profile.followers],
                    ['Publicações', data?.profile.media_count],
                    ['Seguindo', data?.profile.following],
                  ].map(([label, v]) => (
                    <div key={label as string}>
                      {loading && !data ? <Skeleton className="mx-auto h-6 w-14" /> : <p className="text-lg font-semibold tabular-nums">{nf(Number(v ?? 0))}</p>}
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> Alcance · últimos {days} dias
                  </p>
                  {loading ? <Skeleton className="mt-2 h-10 w-32" /> : (
                    <p className="mt-1 font-display text-4xl font-semibold tabular-nums tracking-tight">{nf(data?.summary.reach ?? 0)}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Média de {nf(data?.summary.avg_reach ?? 0)} contas alcançadas por publicação
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {secondary.map(k => (
                    <div key={k.label} className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><k.icon className="h-3.5 w-3.5" />{k.label}</p>
                      {loading ? <Skeleton className="mt-1 h-6 w-16" /> : (
                        <p className={cn(
                          'text-xl font-semibold tabular-nums',
                          k.signed && k.value > 0 && 'text-success',
                          k.signed && k.value < 0 && 'text-destructive',
                        )}>{fmtValue(k)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {!loading && data?.warning && (
            <Card className="border-warning/40">
              <CardContent className="flex items-start gap-2 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>{data.warning}</span>
              </CardContent>
            </Card>
          )}

          {/* Diagnóstico técnico — só quando há erro real da API */}
          {!loading && !!data?._debug?.errLog?.length && (
            <details className="rounded-lg border border-warning/30 p-4 text-xs">
              <summary className="cursor-pointer text-sm font-medium text-warning">
                {data._debug.errLog.length} avisos da API do Instagram
              </summary>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Posts analisados: {data._debug.mediaCount} · Dias com dados: {data._debug.dailyCount}</p>
                <ul className="list-inside list-disc">
                  {data._debug.errLog.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            </details>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução diária</CardTitle>
              <p className="text-xs text-muted-foreground">Alcance e saldo de seguidores por dia</p>
            </CardHeader>
            <CardContent className="h-72 md:h-80">
              {loading ? <Skeleton className="h-full w-full" /> : !hasChartData ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem dados diários no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => nf(Number(v))} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: any) => nf(Number(v))}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area yAxisId="left" type="monotone" dataKey="Alcance" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gReach)" />
                    <Area yAxisId="right" type="monotone" dataKey="Novos seguidores" stroke="hsl(var(--chart-2))" strokeWidth={2} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Melhores publicações */}
          {!!best.length && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <Flame className="h-4 w-4 text-primary" /> Melhores publicações do período
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {best.map((m, i) => (
                  <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer"
                     className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
                    <div className="relative aspect-[4/3] bg-muted">
                      {m.thumbnail && <img src={m.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">#{i + 1}</span>
                      {viralIds.has(m.id) && (
                        <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          <Flame className="h-3 w-3" /> Viral
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 text-sm">{m.caption || 'Sem legenda'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{nf(m.reach)}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{nf(m.likes)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{nf(m.comments)}</span>
                        <span className="ml-auto font-semibold text-foreground">{m.engagement_rate}%</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <DateComparison daily={data?.daily ?? []} onEarliestDateChange={handleEarliestDate} />

          {/* Todas as publicações */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">Publicações ({data?.media?.length ?? 0})</CardTitle>
              <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Ordenar publicações">
                {([['recentes', 'Recentes'], ['alcance', 'Alcance'], ['engajamento', 'Engajamento']] as const).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setSortBy(v)}
                    className={cn('h-7 rounded px-2.5 text-xs font-medium transition-colors',
                      sortBy === v ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
              {!loading && !media.length && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma publicação encontrada.</p>
              )}
              {!loading && !!media.length && (
                <>
                  <div className="hidden grid-cols-[1fr_repeat(5,72px)_64px] gap-2 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground md:grid">
                    <span>Publicação</span>
                    <span className="text-right">Alcance</span>
                    <span className="text-right">Curtidas</span>
                    <span className="text-right">Coment.</span>
                    <span className="text-right">Salvos</span>
                    <span className="text-right">Compart.</span>
                    <span className="text-right">Engaj.</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {media.map(m => (
                      <li key={m.id}>
                        <a href={m.permalink} target="_blank" rel="noreferrer"
                           className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 transition-colors hover:bg-muted/50 md:grid-cols-[1fr_repeat(5,72px)_64px]">
                          <div className="flex min-w-0 items-center gap-3">
                            {m.thumbnail
                              ? <img src={m.thumbnail} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded object-cover" />
                              : <div className="h-11 w-11 shrink-0 rounded bg-muted" />}
                            <div className="min-w-0">
                              <p className="truncate text-sm">{m.caption || 'Sem legenda'}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(m.timestamp).toLocaleDateString('pt-BR')} · {m.is_reel ? 'Reels' : 'Feed'}
                                {viralIds.has(m.id) && <span className="ml-1.5 text-primary">· viral</span>}
                              </p>
                            </div>
                          </div>
                          <span className="hidden text-right text-sm tabular-nums md:block">{nf(m.reach)}</span>
                          <span className="hidden text-right text-sm tabular-nums md:block">{nf(m.likes)}</span>
                          <span className="hidden text-right text-sm tabular-nums md:block">{nf(m.comments)}</span>
                          <span className="hidden text-right text-sm tabular-nums md:block"><Bookmark className="mr-1 inline h-3 w-3 text-muted-foreground" />{nf(m.saved)}</span>
                          <span className="hidden text-right text-sm tabular-nums md:block"><Share2 className="mr-1 inline h-3 w-3 text-muted-foreground" />{nf(m.shares)}</span>
                          <span className="text-right text-sm font-semibold tabular-nums">
                            <span className="mr-2 text-xs font-normal text-muted-foreground md:hidden">{nf(m.reach)} alc.</span>
                            {m.engagement_rate}%
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerar diagnóstico estratégico</DialogTitle>
            <DialogDescription>
              A IA analisa as métricas dos últimos {days} dias e cria um relatório completo para compartilhar com o cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">Nome do cliente</label>
              <Input
                id="name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Restaurante Sabor & Arte"
              />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Tom da mensagem</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTone('positiva')}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-colors',
                    tone === 'positiva' ? 'border-success bg-success/10' : 'border-border hover:border-foreground/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-semibold">Positivo</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Foco em oportunidades.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTone('negativa')}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-colors',
                    tone === 'negativa' ? 'border-destructive bg-destructive/10' : 'border-border hover:border-foreground/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-semibold">Alerta</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Foco em riscos reais.</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateAudit} disabled={isGeneratingAudit || !clientName.trim()}>
              {isGeneratingAudit ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : 'Gerar relatório'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
