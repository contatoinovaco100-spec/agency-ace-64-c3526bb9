import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Flame, Heart, MessageCircle, RefreshCw, Users, Eye, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  profile: { username: string; name: string; picture: string; followers: number; following: number; media_count: number };
  summary: { reach: number; profile_views: number; gained_followers: number; avg_reach: number; avg_engagement_rate: number; days: number };
  daily: Array<{ date: string; reach?: number; profile_views?: number; follower_count?: number }>;
  media: Array<{
    id: string; caption: string; is_reel: boolean; thumbnail: string; permalink: string;
    timestamp: string; likes: number; comments: number; saved: number; shares: number;
    plays: number; reach: number; engagement: number; engagement_rate: number;
  }>;
  viral?: AnalyticsData['media'];
  history?: Array<{ snapshot_date: string; followers: number; reach: number; profile_views: number }>;
}

const nf = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);

export default function InstagramAnalyticsPage() {
  const { accounts, loading: loadingAccounts } = useSocialAccounts();
  const igAccounts = useMemo(
    () => accounts.filter(a => a.platform === 'instagram' && a.external_id),
    [accounts],
  );

  const [accountId, setAccountId] = useState('');
  const [days, setDays] = useState('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId && igAccounts.length) setAccountId(igAccounts[0].id);
  }, [igAccounts, accountId]);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('instagram-analytics', {
        body: { account_id: accountId, days: Number(days) },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AnalyticsData);
    } catch (e: any) {
      toast.error('Erro ao carregar métricas', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [accountId, days]);

  useEffect(() => { load(); }, [load]);

  const chartData = (data?.daily ?? []).map(d => ({
    date: d.date.slice(5),
    Alcance: d.reach ?? 0,
    Visitas: d.profile_views ?? 0,
    Seguidores: d.follower_count ?? 0,
  }));

  const kpis = [
    { label: 'Seguidores', value: nf(data?.profile.followers ?? 0), icon: Users },
    { label: 'Alcance', value: nf(data?.summary.reach ?? 0), icon: Eye },
    { label: 'Visitas ao perfil', value: nf(data?.summary.profile_views ?? 0), icon: BarChart3 },
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
        </div>
      </div>

      {!loadingAccounts && !igAccounts.length && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Nenhuma conta do Instagram conectada. Conecte em <strong>Redes Sociais</strong> para ver as métricas.
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <Area type="monotone" dataKey="Visitas" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
                <Badge variant="secondary">{m.engagement_rate}%</Badge>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
