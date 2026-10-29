import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarClock, Check, ChevronDown, ClipboardList, Copy, FolderUp, Instagram, KeyRound, Loader2, MessageCircle, Phone, Plus, Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type StepKey = 'briefing' | 'instagram' | 'access' | 'materials' | 'kickoff';
type Onboarding = {
  id: string; client_id: string; token: string; status: 'pendente' | 'em_andamento' | 'concluido';
  steps: Partial<Record<StepKey | 'access_call_at', string>>; materials_url: string; kickoff_preference: string;
  sent_at: string | null; last_reminder_at: string | null; created_at: string; updated_at: string;
};
type Client = { id: string; company_name: string; contact_name: string; phone: string };

// Tabela nova: ainda fora dos tipos gerados do Supabase
const TABLE = 'client_onboardings' as never;
/** Dias sem avanço para o onboarding aparecer como travado */
const STALLED_DAYS = 3;

const STEPS: { key: StepKey; label: string; icon: typeof Check }[] = [
  { key: 'briefing', label: 'Briefing', icon: ClipboardList },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'access', label: 'Acesso Instagram', icon: KeyRound },
  { key: 'materials', label: 'Materiais', icon: FolderUp },
  { key: 'kickoff', label: 'Kickoff', icon: CalendarClock },
];

const formatCall = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const linkFor = (o: Onboarding) => `${window.location.origin}/bem-vindo/${o.token}`;
const onlyDigits = (v: string) => v.replace(/\D/g, '');

export default function ClientOnboardingsPage() {
  const [rows, setRows] = useState<Onboarding[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'abertos' | 'travados' | 'concluidos'>('abertos');

  const load = useCallback(async () => {
    const [{ data: ob, error }, { data: cl }] = await Promise.all([
      supabase.from(TABLE).select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name, contact_name, phone').is('deleted_at', null).order('company_name'),
    ]);
    if (error) toast.error('Não foi possível carregar os onboardings', { description: (error as { message: string }).message });
    setRows((ob ?? []) as unknown as Onboarding[]);
    setClients((cl ?? []) as Client[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const withoutOnboarding = clients.filter((c) => !rows.some((r) => r.client_id === c.id)
    && c.company_name.toLowerCase().includes(search.trim().toLowerCase()));

  const isStalled = (o: Onboarding) => o.status !== 'concluido' && daysSince(o.updated_at) >= STALLED_DAYS;
  const visible = rows.filter((o) =>
    filter === 'concluidos' ? o.status === 'concluido' : filter === 'travados' ? isStalled(o) : o.status !== 'concluido');
  const counts = {
    abertos: rows.filter((o) => o.status !== 'concluido').length,
    travados: rows.filter(isStalled).length,
    concluidos: rows.filter((o) => o.status === 'concluido').length,
  };

  // Ligações do código de verificação marcadas pelos clientes (inclui a que começou há menos de 1h)
  const upcomingCalls = rows
    .filter((o) => o.steps?.access_call_at && new Date(o.steps.access_call_at).getTime() > Date.now() - 3_600_000)
    .sort((a, b) => a.steps.access_call_at!.localeCompare(b.steps.access_call_at!));

  const create = async (client: Client) => {
    setPickerOpen(false); setSearch('');
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from(TABLE)
      .insert({ client_id: client.id, created_by: user.user?.id ?? null } as never).select('*').single();
    if (error) { toast.error('Não foi possível criar o onboarding', { description: (error as { message: string }).message }); return; }
    const row = data as unknown as Onboarding;
    setRows((r) => [row, ...r]);
    setExpanded(row.id);
    toast.success(`Onboarding criado para ${client.company_name}`, { description: 'Agora envie o link pelo WhatsApp.' });
  };

  // Registra o envio para o painel saber quando foi o último contato
  const markSent = async (o: Onboarding) => {
    const now = new Date().toISOString();
    const patch = o.sent_at ? { last_reminder_at: now } : { sent_at: now };
    setRows((r) => r.map((x) => (x.id === o.id ? { ...x, ...patch } : x)));
    await supabase.from(TABLE).update(patch as never).eq('id', o.id);
  };

  const copyLink = async (o: Onboarding) => {
    try { await navigator.clipboard.writeText(linkFor(o)); toast.success('Link copiado'); markSent(o); }
    catch { toast.error('Não foi possível copiar'); }
  };

  const whatsapp = (o: Onboarding) => {
    const c = clientById[o.client_id];
    const name = (c?.contact_name || c?.company_name || '').split(/\s+/)[0];
    const message = o.sent_at
      ? `Oi, ${name}! Passando para lembrar do seu onboarding na INOVA. Faltam só alguns passos para a gente começar: ${linkFor(o)}`
      : `Oi, ${name}! Seja muito bem-vindo(a) à INOVA 🎉\n\nPara começarmos, complete seu onboarding (são 5 passos rápidos, dá para fazer pelo celular): briefing, conectar o Instagram, dados de acesso com horário da ligação do código, materiais e horário do kickoff.\n\n${linkFor(o)}`;
    const phone = onlyDigits(c?.phone ?? '');
    const to = phone ? (phone.length <= 11 ? `55${phone}` : phone) : '';
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    markSent(o);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operacional"
        title="Onboarding de clientes"
        description="Cada cliente recebe um link e faz as 5 etapas sozinho. Aqui você acompanha quem avançou e quem travou."
        actions={
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo onboarding</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(340px,calc(100vw-2rem))] p-0">
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar cliente" className="pl-8" />
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {withoutOnboarding.length === 0 && <p className="p-3 text-sm text-muted-foreground">Todos os clientes já têm onboarding.</p>}
                {withoutOnboarding.map((c) => (
                  <button key={c.id} onClick={() => create(c)} className="flex w-full items-center rounded-md p-2 text-left text-sm hover:bg-muted">
                    <span className="truncate">{c.company_name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        }
      />

      {upcomingCalls.length > 0 && (
        <section className="rounded-xl border bg-card">
          <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
            <Phone className="h-4 w-4 text-primary" /> Ligações do código de verificação
            <span className="text-xs font-normal text-muted-foreground">· senha e contato estão na planilha de acessos</span>
          </h2>
          <ul className="divide-y">
            {upcomingCalls.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 font-medium capitalize tabular-nums">{formatCall(o.steps.access_call_at!)}</span>
                <span className="min-w-0 flex-1 truncate">{clientById[o.client_id]?.company_name ?? 'Cliente removido'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {([['abertos', 'Em aberto'], ['travados', `Travados há ${STALLED_DAYS}+ dias`], ['concluidos', 'Concluídos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
              filter === k ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground')}>
            {l} <span className={cn('tabular-nums text-xs', k === 'travados' && counts.travados ? 'text-warning' : 'text-muted-foreground')}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{filter === 'travados' ? 'Ninguém travado. 👏' : filter === 'concluidos' ? 'Nenhum onboarding concluído ainda.' : 'Nenhum onboarding em aberto.'}</p>
          {filter === 'abertos' && <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro em "Novo onboarding" e envie o link ao cliente.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((o) => {
            const c = clientById[o.client_id];
            const doneCount = STEPS.filter((s) => o.steps?.[s.key]).length;
            const stalled = isStalled(o);
            const open = expanded === o.id;
            return (
              <li key={o.id} className="rounded-xl border bg-card">
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                  <button onClick={() => setExpanded(open ? null : o.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c?.company_name ?? 'Cliente removido'}</p>
                      <p className={cn('text-xs', stalled ? 'text-warning' : 'text-muted-foreground')}>
                        {o.status === 'concluido' ? 'Concluído' : !o.sent_at ? 'Link ainda não enviado'
                          : stalled ? `Sem avanço há ${daysSince(o.updated_at)} dias` : `${doneCount} de 5 etapas`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 pl-7 sm:pl-0" aria-label={`${doneCount} de 5 etapas concluídas`}>
                    {STEPS.map((s) => {
                      const done = !!o.steps?.[s.key];
                      return (
                        <span key={s.key} title={`${s.label}: ${done ? 'concluído' : 'pendente'}`}
                          className={cn('flex h-8 w-8 items-center justify-center rounded-full', done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground/60')}>
                          <s.icon className="h-4 w-4" />
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pl-7 sm:pl-0">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyLink(o)}><Copy className="h-3.5 w-3.5" /> Link</Button>
                    {o.status !== 'concluido' && (
                      <Button size="sm" className="gap-1.5" onClick={() => whatsapp(o)}>
                        <MessageCircle className="h-3.5 w-3.5" /> {o.sent_at ? 'Lembrar' : 'Enviar'}
                      </Button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2">
                    {STEPS.map((s) => (
                      <div key={s.key} className="flex items-start gap-2">
                        <s.icon className={cn('mt-0.5 h-4 w-4 shrink-0', o.steps?.[s.key] ? 'text-success' : 'text-muted-foreground')} />
                        <div className="min-w-0">
                          <p className="font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.steps?.[s.key] ? `Concluído em ${new Date(o.steps[s.key]!).toLocaleDateString('pt-BR')}` : 'Pendente'}
                          </p>
                          {s.key === 'materials' && o.materials_url && (
                            <a href={o.materials_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-primary underline-offset-2 hover:underline">{o.materials_url}</a>
                          )}
                          {s.key === 'access' && o.steps?.access_call_at && (
                            <p className="text-xs capitalize">Ligação: {formatCall(o.steps.access_call_at)}</p>
                          )}
                          {s.key === 'kickoff' && o.kickoff_preference && <p className="text-xs">“{o.kickoff_preference}”</p>}
                          {s.key === 'briefing' && o.steps?.briefing && (
                            <a href="/briefings" className="text-xs font-medium text-primary underline-offset-2 hover:underline">Ver respostas</a>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Criado em {new Date(o.created_at).toLocaleDateString('pt-BR')}
                      {o.sent_at && ` · enviado em ${new Date(o.sent_at).toLocaleDateString('pt-BR')}`}
                      {o.last_reminder_at && ` · último lembrete em ${new Date(o.last_reminder_at).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
