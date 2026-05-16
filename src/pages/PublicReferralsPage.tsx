import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trophy, Check, Lock, MessageCircle, Gift, Users, Copy, Link2 } from 'lucide-react';
import { Referral, ReferralClient, ReferralTier, STATUS_LABELS, ReferralStatus } from '@/types/referrals';
import { useToast } from '@/hooks/use-toast';

const WHATSAPP_TARGET = '5500000000000'; // central da Inova
const SHARE_MSG = 'Quero indicar um contato para a Inova 👇';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status: ReferralStatus) {
  const variants: Record<ReferralStatus, string> = {
    enviada: 'bg-muted text-muted-foreground border-border',
    negociacao: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    fechada: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  };
  return (
    <Badge variant="outline" className={variants[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export default function PublicReferralsPage() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<ReferralClient | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [tiers, setTiers] = useState<ReferralTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const closedCount = referrals.filter(r => r.status === 'fechada').length;

  useEffect(() => {
    if (!token) return;
    let alive = true;

    (async () => {
      const { data: clientData } = await supabase
        .from('referral_clients')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!alive) return;
      if (!clientData) { setNotFound(true); setLoading(false); return; }
      setClient(clientData);

      const [refsRes, tiersRes] = await Promise.all([
        supabase.from('referrals').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }),
        supabase.from('referral_tiers').select('*').order('sort_order', { ascending: true }),
      ]);
      if (!alive) return;
      setReferrals((refsRes.data ?? []) as Referral[]);
      setTiers((tiersRes.data ?? []) as ReferralTier[]);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [token]);

  // Realtime
  useEffect(() => {
    if (!client) return;
    const ch = supabase
      .channel(`referrals_${client.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals', filter: `client_id=eq.${client.id}` }, async () => {
        const { data } = await supabase.from('referrals').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
        setReferrals((data ?? []) as Referral[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referral_tiers' }, async () => {
        const { data } = await supabase.from('referral_tiers').select('*').order('sort_order', { ascending: true });
        setTiers((data ?? []) as ReferralTier[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-10 text-center max-w-md">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold mb-2">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de indicações não foi encontrado. Verifique com a Inova se o link está correto.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="border-b border-border/50 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> INOVA · Programa de Indicações
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Olá, <span className="text-primary">{client.name}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base md:text-lg">
            Acompanhe suas indicações e premiações.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span><strong>{referrals.length}</strong> indicações enviadas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-primary" />
              <span><strong>{closedCount}</strong> {closedCount === 1 ? 'fechada' : 'fechadas'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-10">
        {/* TIERS */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Suas premiações
          </h2>
          {tiers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma premiação configurada ainda.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map(tier => {
                const achieved = closedCount >= tier.required_count;
                const inProgress = !achieved && closedCount > 0 && (tiers.findIndex(t => closedCount < t.required_count) === tiers.indexOf(tier));
                const progressPct = Math.min(100, (closedCount / tier.required_count) * 100);

                return (
                  <Card
                    key={tier.id}
                    className={`p-5 relative transition-all ${
                      achieved
                        ? 'border-primary/50 ring-2 ring-primary/30 bg-primary/5'
                        : inProgress
                          ? 'border-yellow-500/40 ring-1 ring-yellow-500/20'
                          : 'opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        achieved ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {achieved ? <Check className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {tier.required_count} {tier.required_count === 1 ? 'indicação' : 'indicações'}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{tier.prize_description}</p>

                    {achieved ? (
                      <div className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Conquistado!
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Progress value={progressPct} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {closedCount} de {tier.required_count}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* TIMELINE */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Suas indicações
          </h2>
          {referrals.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Você ainda não tem indicações. Comece agora indicando alguém!
            </Card>
          ) : (
            <Card className="divide-y divide-border/50">
              {referrals.map(r => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.referred_name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
                  </div>
                  {statusBadge(r.status)}
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* CTA */}
        <section className="pb-10">
          <Card className="p-6 bg-primary/5 border-primary/30 text-center">
            <h3 className="font-bold text-lg mb-2">Indique mais um contato e avance no programa</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Mande pra gente o nome e WhatsApp da pessoa via WhatsApp.
            </p>
            <Button asChild size="lg" className="gap-2">
              <a
                href={`https://wa.me/${WHATSAPP_TARGET}?text=${encodeURIComponent(SHARE_MSG)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-5 w-5" /> Indicar via WhatsApp
              </a>
            </Button>
          </Card>
        </section>
      </main>
    </div>
  );
}
