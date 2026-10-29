import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClock, Check, ClipboardList, Eye, EyeOff, ExternalLink, FolderUp, Instagram, KeyRound, Loader2, Phone,
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

type StepKey = 'briefing' | 'instagram' | 'access' | 'materials' | 'kickoff';
type OnboardingInfo = {
  client_name: string;
  contact_name?: string;
  status: string;
  steps: Partial<Record<StepKey, string>>;
  materials_url: string;
  kickoff_preference: string;
  access_call_at: string | null;
  call_slots: string[];
  accounts: { username: string; platform: string; profile_picture: string }[];
};

async function callOnboarding<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro ao falar com a INOVA');
  return data as T;
}

const STEP_ORDER: StepKey[] = ['briefing', 'instagram', 'access', 'materials', 'kickoff'];

const TZ = 'America/Sao_Paulo';
const formatCall = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
      // Tolera uma versão da função que ainda não manda os horários/contas
      setInfo({ ...data, steps: data.steps ?? {}, accounts: data.accounts ?? [], call_slots: data.call_slots ?? [], access_call_at: data.access_call_at ?? null });
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

        <StepCard n={3} icon={KeyRound} title="Acesso ao Instagram" done={done('access')} active={nextStep === 'access'}
          description="Para entrarmos na sua conta pela primeira vez, o Instagram manda um código de verificação para o seu celular. Passe os dados de acesso e escolha um horário: a gente liga e você só lê o código.">
          <AccessStep
            token={token}
            done={done('access')}
            callAt={info.access_call_at}
            slots={info.call_slots}
            defaultInstagram={info.accounts[0]?.username ?? ''}
            onSaved={(steps, callAt) => setInfo((i) => (i ? { ...i, steps, access_call_at: callAt } : i))}
            onConflict={load}
          />
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

/** Etapa 3: dados de acesso do Instagram (vão para a planilha da INOVA) + horário da ligação do código */
function AccessStep({ token, done, callAt, slots, defaultInstagram, onSaved, onConflict }: {
  token: string; done: boolean; callAt: string | null; slots: string[]; defaultInstagram: string;
  onSaved: (steps: OnboardingInfo['steps'], callAt: string) => void; onConflict: () => void;
}) {
  const [form, setForm] = useState({ instagram: defaultInstagram, password: '', code_contact: '', responsible: '', whatsapp: '', notes: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Agrupa os horários por dia (no fuso de Brasília)
  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    slots.forEach((s) => {
      const key = new Date(s).toLocaleDateString('en-CA', { timeZone: TZ });
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return [...map.entries()];
  }, [slots]);
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? days[0]?.[0] ?? null;
  const daySlots = days.find(([d]) => d === activeDay)?.[1] ?? [];

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const formOk = !!(form.instagram.trim() && form.password && form.code_contact.trim() && form.responsible.trim()
    && form.whatsapp.replace(/\D/g, '').length >= 10);

  const submit = async () => {
    if (!slot) return;
    setSaving(true);
    try {
      const res = await callOnboarding<{ steps: OnboardingInfo['steps']; access_call_at: string }>({
        action: 'access', token, slot, ...(done ? {} : { form }),
      });
      onSaved(res.steps, res.access_call_at);
      setRescheduling(false); setSlot(null);
      setForm((f) => ({ ...f, password: '' }));
      toast.success(`Ligação marcada para ${formatCall(res.access_call_at)}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível salvar';
      toast.error(message);
      if (/ocupado/.test(message)) { setSlot(null); onConflict(); }
    } finally {
      setSaving(false);
    }
  };

  if (done && !rescheduling) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 shrink-0 text-primary" />
          <span>Ligação marcada: <strong>{callAt ? formatCall(callAt) : '—'}</strong></span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setRescheduling(true)}>Remarcar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!done && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Usuário do Instagram">
            <Input value={form.instagram} onChange={set('instagram')} placeholder="@suaempresa" autoCapitalize="none" autoCorrect="off" />
          </Field>
          <Field label="Senha do Instagram">
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="off" className="pr-10" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="E-mail ou celular que recebe o código" className="sm:col-span-2">
            <Input value={form.code_contact} onChange={set('code_contact')} placeholder="(24) 99999-9999 ou email@empresa.com" />
          </Field>
          <Field label="Quem vai estar com o celular">
            <Input value={form.responsible} onChange={set('responsible')} placeholder="Nome" />
          </Field>
          <Field label="WhatsApp dessa pessoa">
            <Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(24) 99999-9999" inputMode="tel" />
          </Field>
          <Field label="Observações (opcional)" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Ex.: a conta também tem um Facebook ligado" className="min-h-[60px]" />
          </Field>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Horário da ligação <span className="font-normal text-muted-foreground">· seg a sex, 10h às 12h</span></p>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum horário livre nos próximos dias. Fale com a equipe da INOVA pelo WhatsApp.</p>
        ) : (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {days.map(([d, list]) => {
                const date = new Date(list[0]);
                return (
                  <button key={d} type="button" onClick={() => { setDay(d); setSlot(null); }}
                    className={cn('flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5 text-xs transition-colors',
                      d === activeDay ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    <span className="capitalize">{date.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'short' }).replace('.', '')}</span>
                    <span className="text-base font-semibold tabular-nums text-foreground">{date.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit' })}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {daySlots.map((s) => (
                <button key={s} type="button" onClick={() => setSlot(s)}
                  className={cn('h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors',
                    slot === s ? 'border-brand bg-brand text-brand-foreground' : 'hover:bg-muted')}>
                  {new Date(s).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto" disabled={!slot || (!done && !formOk) || saving} onClick={submit}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {done ? 'Confirmar novo horário' : 'Enviar e marcar ligação'}
        </Button>
        {rescheduling && <Button variant="ghost" onClick={() => { setRescheduling(false); setSlot(null); }}>Cancelar</Button>}
      </div>
      {!done && (
        <p className="text-xs text-muted-foreground [text-wrap:pretty]">
          Seus dados vão direto para a equipe da INOVA e não ficam salvos nesta página. Depois que a gente entrar, você pode trocar a senha quando quiser.
        </p>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
