import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClock, Check, ClipboardList, Copy, ExternalLink, FolderUp, Instagram, Loader2, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import logoInova from '@/assets/logo-inova.png';

const BriefingFormPage = lazy(() => import('./BriefingFormPage'));

/** Endereço de retorno do login do Meta (já cadastrado no app da INOVA) */
const META_REDIRECT_URI = 'https://inovamarketing.online/redes-sociais';

type StepKey = 'briefing' | 'instagram' | 'meta_partner' | 'materials' | 'kickoff';
type OnboardingInfo = {
  client_name: string;
  contact_name?: string;
  status: string;
  steps: Partial<Record<StepKey, string>>;
  materials_url: string;
  kickoff_preference: string;
  meta_business_id: string;
  accounts: { username: string; platform: string; profile_picture: string }[];
};

async function callOnboarding<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro ao falar com a INOVA');
  return data as T;
}

const STEP_ORDER: StepKey[] = ['briefing', 'instagram', 'meta_partner', 'materials', 'kickoff'];

export default function ClientOnboardingPage() {
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState<OnboardingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'steps' | 'briefing'>('steps');
  const [busy, setBusy] = useState<StepKey | null>(null);
  const [materials, setMaterials] = useState('');
  const [kickoff, setKickoff] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await callOnboarding<OnboardingInfo>({ action: 'get', token });
      setInfo(data);
      setMaterials(data.materials_url);
      setKickoff(data.kickoff_preference);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Voltou do login do Facebook com sucesso
  useEffect(() => {
    if (params.get('conectado')) {
      toast.success('Instagram conectado. Obrigado!');
      setParams((p) => { p.delete('conectado'); return p; }, { replace: true });
    }
  }, [params, setParams]);

  const done = (k: StepKey) => !!info?.steps?.[k];
  const doneCount = STEP_ORDER.filter(done).length;
  const nextStep = STEP_ORDER.find((k) => !done(k));

  const connectInstagram = async () => {
    setBusy('instagram');
    try {
      const { url } = await callOnboarding<{ url: string }>({ action: 'auth_url', token, redirect_uri: META_REDIRECT_URI });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o login do Facebook');
      setBusy(null);
    }
  };

  const completeStep = async (step: StepKey, extra: Record<string, unknown> = {}) => {
    setBusy(step);
    try {
      const res = await callOnboarding<{ steps: OnboardingInfo['steps'] }>({ action: 'step', token, step, ...extra });
      setInfo((i) => (i ? { ...i, steps: res.steps } : i));
      toast.success('Etapa concluída');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copiado'); } catch { toast.error('Não foi possível copiar'); }
  };

  if (view === 'briefing') {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <BriefingFormPage onboardingToken={token} onDone={() => { setView('steps'); load(); }} />
      </Suspense>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-2xl bg-card p-6 text-center card-shadow">
          <h1 className="font-display text-xl font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error} Fale com a equipe da INOVA para receber um novo link.</p>
        </div>
      </Shell>
    );
  }

  if (!info) return <FullScreenLoader />;

  // Saúda a pessoa de contato; sem ela, usa o nome da empresa inteiro
  const firstName = info.contact_name?.trim().split(/\s+/)[0] || info.client_name;

  return (
    <Shell>
      <header className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Onboarding INOVA</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight [text-wrap:balance]">
          {doneCount === STEP_ORDER.length ? `Tudo pronto, ${firstName}!` : `Bem-vindo à INOVA, ${firstName}`}
        </h1>
        <p className="text-sm text-muted-foreground [text-wrap:pretty]">
          {doneCount === STEP_ORDER.length
            ? 'Recebemos tudo o que precisávamos. Nossa equipe já está preparando o seu primeiro mês de conteúdo.'
            : 'São 5 passos rápidos para a gente começar a produzir. Você pode parar e voltar por este mesmo link quando quiser.'}
        </p>
        <div className="flex items-center gap-3 pt-1">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(doneCount / STEP_ORDER.length) * 100}%` }} />
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{doneCount} de {STEP_ORDER.length}</span>
        </div>
      </header>

      <ol className="space-y-3">
        <StepCard n={1} icon={ClipboardList} title="Briefing da marca" done={done('briefing')} active={nextStep === 'briefing'}
          description="Um bate-papo de uns 5 minutos sobre o seu negócio, público e objetivos.">
          {!done('briefing') && <Button className="w-full sm:w-auto" onClick={() => setView('briefing')}>Responder o briefing</Button>}
        </StepCard>

        <StepCard n={2} icon={Instagram} title="Conectar o Instagram" done={done('instagram')} active={nextStep === 'instagram'}
          description="Entre com o Facebook que administra a página da sua empresa. Assim publicamos e acompanhamos os resultados sem precisar de senha.">
          {info.accounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {info.accounts.map((a) => (
                <span key={a.username} className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  <Check className="h-3 w-3" /> @{a.username}
                </span>
              ))}
            </div>
          )}
          <Button variant={done('instagram') ? 'outline' : 'default'} className="w-full gap-2 sm:w-auto" onClick={connectInstagram} disabled={busy === 'instagram'}>
            {busy === 'instagram' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            {done('instagram') ? 'Conectar outra conta' : 'Entrar com Facebook'}
          </Button>
          {!done('instagram') && (
            <p className="text-xs text-muted-foreground [text-wrap:pretty]">
              O Instagram precisa ser profissional (empresa ou criador) e estar ligado a uma página do Facebook. Na tela do Facebook, marque a sua página e a conta do Instagram.
            </p>
          )}
        </StepCard>

        <StepCard n={3} icon={ShieldCheck} title="Acesso de parceiro no Meta" done={done('meta_partner')} active={nextStep === 'meta_partner'}
          description="A forma oficial de dar à agência acesso à página e aos anúncios, sem compartilhar senha. Você pode remover quando quiser.">
          {!done('meta_partner') && (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/80">
                <li>Abra as <a href="https://business.facebook.com/settings/partners" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">configurações de parceiros do seu Gerenciador de Negócios</a>.</li>
                <li>Toque em <strong>Adicionar</strong> → <strong>Conceder a um parceiro acesso aos seus ativos</strong>.</li>
                <li>
                  Cole o ID da INOVA:{' '}
                  {info.meta_business_id ? (
                    <button onClick={() => copy(info.meta_business_id)} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">
                      {info.meta_business_id} <Copy className="h-3 w-3" />
                    </button>
                  ) : <span className="text-muted-foreground">a equipe da INOVA vai te enviar o ID</span>}
                </li>
                <li>Marque a <strong>Página</strong>, a <strong>conta do Instagram</strong> e a <strong>conta de anúncios</strong> com acesso total.</li>
              </ol>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => completeStep('meta_partner')} disabled={busy === 'meta_partner'}>
                {busy === 'meta_partner' && <Loader2 className="h-4 w-4 animate-spin" />} Já dei o acesso
              </Button>
            </>
          )}
        </StepCard>

        <StepCard n={4} icon={FolderUp} title="Logo e materiais" done={done('materials')} active={nextStep === 'materials'}
          description="Cole o link de uma pasta (Google Drive, Dropbox, WeTransfer) com logo, manual da marca, fotos e vídeos que você já tenha.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="https://drive.google.com/…" inputMode="url" />
            <Button variant={done('materials') ? 'outline' : 'default'} className="shrink-0"
              disabled={!/^https?:\/\/\S+\.\S+/.test(materials.trim()) || busy === 'materials'}
              onClick={() => completeStep('materials', { materials_url: materials.trim() })}>
              {busy === 'materials' && <Loader2 className="h-4 w-4 animate-spin" />} {done('materials') ? 'Atualizar link' : 'Enviar link'}
            </Button>
          </div>
        </StepCard>

        <StepCard n={5} icon={CalendarClock} title="Reunião de kickoff" done={done('kickoff')} active={nextStep === 'kickoff'}
          description="Diga os melhores dias e horários para a reunião de início. A equipe confirma com você pelo WhatsApp.">
          <Textarea value={kickoff} onChange={(e) => setKickoff(e.target.value)} placeholder="Terças e quintas, depois das 14h" className="min-h-[80px]" />
          <Button variant={done('kickoff') ? 'outline' : 'default'} className="w-full sm:w-auto"
            disabled={kickoff.trim().length < 3 || busy === 'kickoff'}
            onClick={() => completeStep('kickoff', { kickoff_preference: kickoff.trim() })}>
            {busy === 'kickoff' && <Loader2 className="h-4 w-4 animate-spin" />} {done('kickoff') ? 'Atualizar horários' : 'Enviar horários'}
          </Button>
        </StepCard>
      </ol>

      <p className="pb-6 text-center text-xs text-muted-foreground">Dúvidas? Responda a mensagem da INOVA no WhatsApp.</p>
    </Shell>
  );
}

function StepCard({ n, icon: Icon, title, description, done, active, children }: {
  n: number; icon: typeof Check; title: string; description: string; done: boolean; active: boolean; children?: React.ReactNode;
}) {
  return (
    <li className={cn('rounded-2xl bg-card p-4 card-shadow transition-shadow sm:p-5', active && 'ring-2 ring-primary/60')}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          done ? 'bg-success text-white' : active ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground')}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-muted-foreground" /> {title}
              {done && <span className="text-xs font-medium text-success">Concluído</span>}
            </h2>
            {!done && <p className="mt-1 text-sm text-muted-foreground [text-wrap:pretty]">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-xl space-y-6 px-4 py-6 sm:py-10">
        <img src={logoInova} alt="INOVA Co." className="-ml-2 h-12" />
        {children}
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

/** Retorno do login do Facebook iniciado no onboarding (state = "onb.<token>"): conclui e volta ao link do cliente. */
export function OnboardingConnectCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const token = (params.get('state') || '').replace(/^onb\./, '');
  const started = useRef(false);

  useEffect(() => {
    // O código do Facebook vale uma única vez: evita a segunda chamada do modo estrito do React
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    if (!code) {
      setError(params.get('error_description') || 'O login com o Facebook foi cancelado.');
      return;
    }
    callOnboarding({ action: 'connect', token, code, redirect_uri: META_REDIRECT_URI })
      .then(() => navigate(`/bem-vindo/${token}?conectado=1`, { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Conectando seu Instagram…</p>
      </div>
    );
  }
  return (
    <Shell>
      <div className="space-y-3 rounded-2xl bg-card p-6 text-center card-shadow">
        <h1 className="font-display text-xl font-semibold">Não deu para conectar</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button className="gap-2" onClick={() => navigate(`/bem-vindo/${token}`)}><ExternalLink className="h-4 w-4" /> Voltar ao onboarding</Button>
      </div>
    </Shell>
  );
}
