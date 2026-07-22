import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Eye, Heart, TrendingUp, Image, Loader2, RefreshCw, Instagram, Unplug, ExternalLink } from 'lucide-react';

interface MetaAccount {
  id: string;
  client_id: string;
  instagram_account_id: string;
  facebook_page_id: string;
  access_token: string;
  account_name: string;
}

interface InsightsData {
  profile: {
    name: string;
    username: string;
    profile_picture_url?: string;
    followers_count: number;
    media_count: number;
    follows_count: number;
  };
  insights: Array<{
    name: string;
    title: string;
    values: Array<{ value: number; end_time: string }>;
  }>;
  media: Array<{
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  }>;
}

interface PageAccount {
  id: string;
  name: string;
  instagram_business_account?: { id: string; name: string; username: string };
}

export function MetaInsightsPanel({ clientId }: { clientId: string }) {
  const [metaAccount, setMetaAccount] = useState<MetaAccount | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [pages, setPages] = useState<PageAccount[]>([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [loadingPages, setLoadingPages] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [step, setStep] = useState<'token' | 'pick'>('token');

  useEffect(() => { loadMetaAccount(); }, [clientId]);

  const loadMetaAccount = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_meta_accounts')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    const account = data as MetaAccount | null;
    setMetaAccount(account);
    if (account?.access_token && account?.instagram_account_id) {
      await fetchInsights();
    }
    setLoading(false);
  };

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-insights', {
        body: { action: 'get_insights', client_id: clientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsights(data);
    } catch (err: any) {
      console.error('Error fetching insights:', err);
      toast.error('Erro ao carregar insights: ' + (err.message || 'Erro desconhecido'));
    }
    setLoadingInsights(false);
  };

  const handleFetchAccounts = async () => {
    setLoadingPages(true);
    try {
      let longToken = "";
      if (tokenInput.trim()) {
        // Exchange for long-lived token
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('meta-insights', {
          body: { action: 'exchange_token', access_token: tokenInput.trim() },
        });
        if (tokenError) throw tokenError;
        if (tokenData?.error) throw new Error(tokenData.error);
        longToken = tokenData.access_token;
      }

      // Get pages/accounts (if longToken is empty, function will fallback to global token)
      const { data: accountsData, error: accErr } = await supabase.functions.invoke('meta-insights', {
        body: { action: 'get_accounts', access_token: longToken, client_id: clientId },
      });
      if (accErr) throw accErr;
      if (accountsData?.error) throw new Error(accountsData.error);

      const pagesWithIg = (accountsData.pages || []).filter((p: PageAccount) => p.instagram_business_account);

      if (pagesWithIg.length === 0) {
        toast.error('Nenhuma conta comercial do Instagram encontrada. A página precisa ter um Instagram Business vinculado.');
        setLoadingPages(false);
        return;
      }

      setPendingToken(longToken);

      if (pagesWithIg.length === 1) {
        await saveAccount(pagesWithIg[0], longToken);
      } else {
        setPages(pagesWithIg);
        setStep('pick');
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Token inválido ou não configurado no servidor'));
    }
    setLoadingPages(false);
  };

  const saveAccount = async (page: PageAccount, token: string) => {
    try {
      const { error } = await supabase.functions.invoke('meta-insights', {
        body: {
          action: 'save_account',
          client_id: clientId,
          access_token: token,
          instagram_account_id: page.instagram_business_account?.id || '',
          facebook_page_id: page.id,
          account_name: page.instagram_business_account?.username || page.name,
        },
      });
      if (error) throw error;
      toast.success('Instagram conectado com sucesso!');
      closeConfig();
      await loadMetaAccount();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
  };

  const handlePickSave = () => {
    const page = pages.find(p => p.id === selectedPage);
    if (page) saveAccount(page, pendingToken);
  };

  const closeConfig = () => {
    setConfigOpen(false);
    setTokenInput('');
    setPages([]);
    setPendingToken('');
    setSelectedPage('');
    setStep('token');
  };

  const handleDisconnect = async () => {
    if (!metaAccount) return;
    await supabase.from('client_meta_accounts').delete().eq('client_id', clientId);
    setMetaAccount(null);
    setInsights(null);
    toast.success('Conta desconectada');
  };

  const sumInsightValues = (metricName: string): number => {
    const metric = insights?.insights?.find(i => i.name === metricName);
    if (!metric?.values) return 0;
    return metric.values.reduce((sum, v) => sum + (v.value || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Not connected state
  if (!metaAccount?.access_token || !metaAccount?.instagram_account_id) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <Instagram className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Conectar Instagram</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Vincule a conta do Instagram para ver alcance, impressões, engajamento e publicações
          </p>
          <Button className="mt-4 gap-2" onClick={() => setConfigOpen(true)}>
            <Instagram className="h-4 w-4" />
            Conectar conta
          </Button>
        </div>

        <Dialog open={configOpen} onOpenChange={(open) => { if (!open) closeConfig(); else setConfigOpen(true); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar Instagram</DialogTitle>
            </DialogHeader>

            {step === 'token' && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Como obter o token:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o Graph API Explorer</li>
                    <li>Selecione seu app</li>
                    <li>Marque as permissões: <span className="font-mono text-primary">instagram_basic</span>, <span className="font-mono text-primary">instagram_manage_insights</span>, <span className="font-mono text-primary">pages_show_list</span></li>
                    <li>Clique em "Generate Access Token"</li>
                    <li>Cole o token abaixo</li>
                  </ol>
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir Graph API Explorer
                  </a>
                </div>

                <div>
                  <Label>Access Token (Opcional)</Label>
                  <Input
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Cole o token aqui..."
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <Button onClick={handleFetchAccounts} disabled={loadingPages} className="w-full gap-2">
                  {loadingPages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
                  {loadingPages ? 'Buscando contas...' : tokenInput.trim() ? 'Conectar com este token' : 'Conectar via Token Global'}
                </Button>
              </div>
            )}

            {step === 'pick' && (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Encontramos {pages.length} contas. Selecione qual vincular:</p>
                <Select value={selectedPage} onValueChange={setSelectedPage}>
                  <SelectTrigger><SelectValue placeholder="Escolha a conta..." /></SelectTrigger>
                  <SelectContent>
                    {pages.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        @{p.instagram_business_account?.username} ({p.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handlePickSave} disabled={!selectedPage} className="w-full">
                  Vincular esta conta
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Connected state with insights
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {insights?.profile?.profile_picture_url && (
            <img src={insights.profile.profile_picture_url} alt="" className="h-10 w-10 rounded-full border border-border" />
          )}
          <div>
            <h3 className="text-base font-semibold text-foreground">
              @{insights?.profile?.username || metaAccount.account_name}
            </h3>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchInsights} disabled={loadingInsights}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingInsights ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-destructive hover:text-destructive">
            <Unplug className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loadingInsights ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : insights ? (
        <>
          {/* Profile Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Users} label="Seguidores" value={insights.profile.followers_count} color="text-primary" />
            <StatCard icon={Users} label="Seguindo" value={insights.profile.follows_count} color="text-info" />
            <StatCard icon={Image} label="Publicações" value={insights.profile.media_count} color="text-success" />
          </div>

          {/* Insights Metrics */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Eye} label="Alcance" value={sumInsightValues('reach')} color="text-primary" />
            <StatCard icon={Eye} label="Impressões" value={sumInsightValues('impressions')} color="text-info" />
            <StatCard icon={Heart} label="Engajamento" value={sumInsightValues('accounts_engaged')} color="text-destructive" />
            <StatCard icon={TrendingUp} label="Visitas ao perfil" value={sumInsightValues('profile_views')} color="text-success" />
          </div>

          {/* Recent Media */}
          {insights.media.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Publicações recentes</h4>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {insights.media.map(m => (
                  <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-secondary">
                    <img
                      src={m.thumbnail_url || m.media_url}
                      alt={m.caption?.slice(0, 50) || ''}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-3 bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                        <Heart className="h-3 w-3" /> {m.like_count || 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                        💬 {m.comments_count || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <Button variant="outline" onClick={fetchInsights}>Carregar Insights</Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-card border border-border p-4">
      <Icon className={`h-5 w-5 ${color} mb-1`} />
      <p className="text-lg font-bold text-foreground">{(value || 0).toLocaleString('pt-BR')}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
