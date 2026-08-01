import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Instagram, Music2, Share2, CalendarClock, AlertTriangle, Send, Loader2, LogIn,
  HelpCircle, CheckCircle2, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { AccountCard } from '@/components/social/AccountCard';
import { AddAccountDialog } from '@/components/social/AddAccountDialog';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import { socialAccountsService } from '@/services/socialAccounts';
import type { SocialAccount, SocialPlatform } from '@/types/social';


/** URI fixo — precisa estar cadastrado no app da Meta / TikTok. */
const REDIRECT_URI = 'https://inovamarketing.online/redes-sociais';

export default function SocialAccountsPage() {
  const { accounts, byPlatform, loading, refreshing, reload } = useSocialAccounts();
  const { jobs } = usePublishJobs();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);

  const offDomain = typeof window !== 'undefined' &&
    window.location.origin !== 'https://inovamarketing.online';

  // Retorno do OAuth (?code=...&state=...)
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (err) {
      toast.error('Login cancelado', { description: err });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (!code) return;
    const platform = (sessionStorage.getItem('social_oauth_platform') || 'instagram') as SocialPlatform;
    window.history.replaceState({}, '', window.location.pathname);
    (async () => {
      setConnecting(platform);
      try {
        const res = await socialAccountsService.connect(platform, code, REDIRECT_URI);
        toast.success(`Conectado: ${res.accounts.map(a => '@' + a).join(', ')}`);
        reload();
      } catch (e: any) {
        toast.error('Erro ao conectar', { description: e?.message });
      } finally {
        sessionStorage.removeItem('social_oauth_platform');
        setConnecting(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLogin = async (platform: SocialPlatform) => {
    setConnecting(platform);
    try {
      const url = await socialAccountsService.getAuthUrl(platform, REDIRECT_URI);
      sessionStorage.setItem('social_oauth_platform', platform);
      window.location.href = url;
    } catch (e: any) {
      toast.error('Não foi possível iniciar o login', { description: e?.message });
      setConnecting(null);
    }
  };

  const reconnect = async (a: SocialAccount) => {
    setSyncingId(a.id);
    try {
      if (a.external_id) {
        const res = await socialAccountsService.sync(a.id);
        if (res.status === 'expired') {
          toast.error('Token expirado — refaça o login', { description: res.details });
        } else {
          toast.success('Conta sincronizada');
        }
      } else {
        await socialAccountsService.touch(a.id);
        toast.success('Conta atualizada');
      }
      reload();
    } catch (e: any) {
      toast.error('Erro ao atualizar', { description: e?.message });
    } finally {
      setSyncingId(null);
    }
  };


  const remove = async (a: SocialAccount) => {
    if (!confirm(`Remover @${a.username}?`)) return;
    try {
      await socialAccountsService.remove(a.id);
      toast.success('Conta removida');
      reload();
    } catch (e: any) {
      toast.error('Erro ao remover', { description: e?.message });
    }
  };


  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      accounts: accounts.length,
      today: jobs.filter(j => new Date(j.created_at).toDateString() === today).length,
      scheduled: jobs.filter(j => j.status === 'scheduled').length,
      failed: jobs.filter(j => j.status === 'failed' || j.status === 'partial').length,
      last: jobs[0] ? new Date(jobs[0].created_at).toLocaleString('pt-BR') : '—',
    };
  }, [accounts, jobs]);

  const sections: Array<{ platform: SocialPlatform; label: string; icon: any }> = [
    { platform: 'instagram', label: 'Instagram', icon: Instagram },
    { platform: 'tiktok', label: 'TikTok', icon: Music2 },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Redes Sociais</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie todas as contas conectadas e publique em várias delas de uma vez.
        </p>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">Publicação automática</p>
            <p className="text-muted-foreground">
              Faça login na conta com <strong>Conectar</strong> (Instagram Business/Criador
              vinculado a uma Página do Facebook). Contas conectadas por login publicam de verdade
              ao clicar em Publicar. Contas cadastradas manualmente continuam no modo copiar/baixar.
            </p>
          </div>
        </CardContent>
      </Card>

      {offDomain && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">Abra pelo domínio oficial para conectar</p>
              <p className="text-muted-foreground">
                O login das redes só retorna para <strong>https://inovamarketing.online/redes-sociais</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ConnectionGuide />






      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Contas conectadas', value: stats.accounts, icon: Share2 },
          { label: 'Publicações hoje', value: stats.today, icon: Send },
          { label: 'Agendadas', value: stats.scheduled, icon: CalendarClock },
          { label: 'Falhas', value: stats.failed, icon: AlertTriangle },
          { label: 'Última publicação', value: stats.last, icon: CalendarClock },
        ].map(s => (
          <Card key={s.label} className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{s.value}</p>
                <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sections.map(({ platform, label, icon: Icon }) => {
        const list = byPlatform(platform);
        return (
          <section key={platform} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Icon className="h-4 w-4" /> {label}
                <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                <AddAccountDialog platform={platform} label={label} onAdded={reload} />
                <Button size="sm" onClick={() => startLogin(platform)} disabled={connecting === platform}>
                  {connecting === platform
                    ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    : <LogIn className="mr-1 h-4 w-4" />}
                  Conectar {label}
                </Button>
              </div>
            </div>


            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
              </div>
            ) : list.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conta {label} conectada ainda.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {list.map(a => (
                  <AccountCard
                    key={a.id} account={a} syncing={syncingId === a.id}
                    onReconnect={reconnect} onRemove={remove}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ConnectionGuide() {
  const [open, setOpen] = useState(true);
  const steps = [
    {
      label: 'Instagram precisa ser Business/Criador',
      desc: 'Acesse o app do Instagram → Configurações → Conta → Alternar para conta profissional. Escolha Business ou Criador.',
    },
    {
      label: 'Vincule a uma Página do Facebook',
      desc: 'No Centro de Contas do Meta, conecte seu perfil do Instagram a uma Página do Facebook que você administra.',
    },
    {
      label: 'Cadastre o endereço de retorno no Meta',
      desc: 'Abra developers.facebook.com, vá em seu app, Login do Facebook → Configurações, e adicione exatamente: https://inovamarketing.online/redes-sociais',
    },
    {
      label: 'Clique em "Conectar Instagram" aqui na plataforma',
      desc: 'Use este botão quando estiver no domínio oficial inovamarketing.online. O preview do editor não funciona.',
    },
    {
      label: 'Autorize o app no Facebook',
      desc: 'Marque todas as Páginas que aparecerem e confirme. A INOVA só recebe permissão de publicar — não altera sua senha.',
    },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="h-4 w-4 text-primary" />
            Como conectar o Instagram automaticamente (passo a passo)
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {open && (
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Se aparecer "Recurso indisponível" no login, o app da Meta ainda está em modo de desenvolvimento.
            Você precisa ir em <strong>Configurações → Básico</strong> do app, preencher a URL da política de privacidade,
            categoria e ícone, e depois mudar o seletor de <strong>Desenvolvimento → Ao vivo</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

