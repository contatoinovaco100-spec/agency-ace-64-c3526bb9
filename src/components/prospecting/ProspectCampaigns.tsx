import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink, Eye, Loader2, MapPin, Pencil, Plus, Search, Shuffle, Star, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { nicheKey, nicheLabel } from '@/lib/prospectNiche';

type Campaign = {
  id?: string; name: string; niche: string; city: string; session_id: string | null; pitch: string; example_message: string;
  daily_limit: number; min_gap_min: number; max_gap_min: number; start_hour: number; end_hour: number;
  weekdays_only: boolean; active: boolean; last_search_at?: string | null;
  /** Sequência do CRM para quem responder */
  followup_sequence_id?: string | null;
  /** Um por vez (intervalo em minutos) ou em lotes (N seguidas com intervalo de segundos, depois pausa) */
  send_mode?: 'um_por_vez' | 'lotes'; batch_size?: number; batch_min_sec?: number; batch_max_sec?: number; batch_pause_min?: number;
  batch_running_since?: string | null;
};
type Prospect = {
  id: string; campaign_id: string; name: string; phone: string; address: string; category: string; rating: number | null;
  reviews: number | null; website: string; maps_url: string; status: string; message: string; error: string;
  sent_at: string | null; replied_at: string | null; lead_id: string | null;
};
type WaNumber = { id: string; name: string; is_default: boolean };
type Sequence = { id: string; name: string; active: boolean; steps: { day: number }[] };

const CAMPAIGNS = 'prospect_campaigns' as never;
const PROSPECTS = 'prospects' as never;

const STATUS: Record<string, { label: string; tone: string }> = {
  novo: { label: 'Na fila', tone: 'bg-muted text-muted-foreground' },
  enviando: { label: 'Enviando…', tone: 'bg-primary/10 text-primary' },
  enviado: { label: 'Enviado', tone: 'bg-primary/10 text-primary' },
  respondeu: { label: 'Respondeu', tone: 'bg-success/15 text-success' },
  nao_quer: { label: 'Pediu para parar', tone: 'bg-muted text-muted-foreground' },
  sem_whatsapp: { label: 'Sem WhatsApp', tone: 'bg-muted text-muted-foreground' },
  descartado: { label: 'Descartado', tone: 'bg-muted text-muted-foreground' },
  erro: { label: 'Erro', tone: 'bg-destructive/10 text-destructive' },
};
const FILTERS = [
  { id: 'all', label: 'Todos' }, { id: 'novo', label: 'Na fila' }, { id: 'enviado', label: 'Enviados' },
  { id: 'respondeu', label: 'Responderam' }, { id: 'outros', label: 'Fora da fila' },
];

const EMPTY: Campaign = {
  name: '', niche: '', city: 'Volta Redonda, RJ', session_id: null,
  pitch: 'Somos a INOVA, agência de Volta Redonda. Fazemos gestão de redes sociais e produção de vídeos para empresas da região.',
  example_message: '', daily_limit: 30, min_gap_min: 5, max_gap_min: 15, start_hour: 9, end_hour: 18, weekdays_only: true, active: false,
};

/** Mensagem da prospecção Manual (com {agencia} já trocado), para a campanha começar com o seu texto */
function manualTemplate() {
  try {
    const tpl = localStorage.getItem('prospection_message_template') ?? '';
    const agency = localStorage.getItem('prospection_agency_name') || 'INOVA';
    return tpl.replace(/\{agencia\}/gi, agency).trim();
  } catch { return ''; }
}

/** Igual ao envio: troca {empresa}, {nicho}, {cidade} e sorteia uma das variações {Oi|Olá} */
function renderMessage(c: Campaign, p: { name: string; category: string }) {
  const vars: Record<string, string> = { empresa: p.name, nicho: p.category || c.niche, cidade: c.city };
  return c.example_message.trim()
    .replace(/\{(empresa|nicho|cidade)\}/gi, (_, k: string) => vars[k.toLowerCase()] ?? '')
    .replace(/\{([^{}]*\|[^{}]*)\}/g, (_, opts: string) => { const o = opts.split('|'); return o[Math.floor(Math.random() * o.length)].trim(); });
}

/** Sequência de follow-up sugerida para campanhas novas: a da prospecção, se existir */
const defaultSequence = (seqs: Sequence[]) => seqs.find((q) => /prospec/i.test(q.name))?.id ?? null;

/** Por que a primeira mensagem não saiu na hora */
const START_REASON: Record<string, string> = {
  'fora do horário': 'Fora do horário de envio da campanha: começa sozinha no próximo horário (ajuste em Editar).',
  'fim de semana': 'Hoje é fim de semana e a campanha envia só de seg a sex: começa na segunda (ajuste em Editar).',
  'limite do dia': 'O limite de hoje já foi atingido: continua amanhã.',
  'fila vazia': 'A fila está vazia: puxe empresas da Manual ou busque no Google.',
  'sem mensagem': 'A campanha está sem mensagem: escreva a mensagem em Editar.',
  'lote em andamento': 'Já tem um lote sendo enviado agora: o próximo começa depois da pausa.',
  'nenhum com WhatsApp nesta rodada': 'As primeiras da fila não têm WhatsApp; a próxima rodada (em até 5 min) tenta as seguintes.',
};

const BATCH_DEFAULTS = { batch_size: 20, batch_min_sec: 8, batch_max_sec: 20, batch_pause_min: 5 };
const isBatch = (c: Campaign) => c.send_mode === 'lotes';
const pacingLabel = (c: Campaign) => isBatch(c)
  ? `lotes de ${c.batch_size ?? 20} (a cada ${c.batch_min_sec ?? 8}–${c.batch_max_sec ?? 20} s), pausa de ${c.batch_pause_min ?? 5} min`
  : `a cada ${c.min_gap_min}–${c.max_gap_min} min`;

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('prospecting', { body });
  if (error || (data as { error?: string })?.error) {
    let msg = (data as { error?: string })?.error;
    if (!msg) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* sem corpo */ } }
    throw new Error(msg || 'Função de prospecção indisponível');
  }
  return data as T;
}

/** Prospecção automática: campanhas que buscam empresas no Google e mandam a primeira mensagem pelo WhatsApp */
export function ProspectCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    const [{ data: c, error }, { data: p }, { data: n }] = await Promise.all([
      supabase.from(CAMPAIGNS).select('*').order('created_at'),
      supabase.from(PROSPECTS).select('*').not('campaign_id', 'is', null).order('created_at', { ascending: false }).limit(2000),
      supabase.from('wa_numbers' as never).select('id, name, is_default').order('name'),
    ]);
    const { data: seqs } = await supabase.from('crm_sequences' as never).select('id, name, active, steps').order('name');
    setSequences((seqs ?? []) as unknown as Sequence[]);
    setMissing(!!error);
    const list = (c ?? []) as unknown as Campaign[];
    setCampaigns(list);
    setProspects((p ?? []) as unknown as Prospect[]);
    setNumbers((n ?? []) as unknown as WaNumber[]);
    setSelected((s) => s ?? list[0]?.id ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const out: Record<string, { queue: number; sent: number; replied: number; today: number }> = {};
    const t = todayStart();
    for (const p of prospects) {
      const s = (out[p.campaign_id] ??= { queue: 0, sent: 0, replied: 0, today: 0 });
      if (p.status === 'novo') s.queue++;
      if (p.sent_at) { s.sent++; if (new Date(p.sent_at).getTime() >= t) s.today++; }
      if (p.status === 'respondeu') s.replied++;
    }
    return out;
  }, [prospects]);

  const toggle = async (c: Campaign, active: boolean) => {
    setCampaigns((list) => list?.map((x) => (x.id === c.id ? { ...x, active } : x)) ?? null);
    if (!active) {
      const { error } = await supabase.from(CAMPAIGNS).update({ active, updated_at: new Date().toISOString() } as never).eq('id', c.id!);
      if (error) { toast.error('Não foi possível pausar'); load(); return; }
      toast.success('Campanha pausada');
      return;
    }
    // Ligar = começar na hora: a primeira mensagem sai agora, as próximas seguem o intervalo
    const t = toast.loading('Iniciando os disparos…');
    try {
      const r = await invoke<{ sent?: string; batch?: number; skipped?: string; error?: string }>({ action: 'start', campaign_id: c.id });
      if (r.batch) toast.success(`Disparos iniciados: lote de ${r.batch} mensagens saindo agora`, { id: t, description: `Uma a cada ${c.batch_min_sec ?? 8}–${c.batch_max_sec ?? 20} s; depois pausa de ${c.batch_pause_min ?? 5} min e vem o próximo lote.` });
      else if (r.sent) toast.success(`Disparos iniciados: primeira mensagem enviada para ${r.sent}`, { id: t, description: `As próximas saem a cada ${c.min_gap_min}–${c.max_gap_min} min.` });
      else if (r.error) toast.error('Campanha ligada, mas o envio falhou', { id: t, description: r.error });
      else toast.info('Campanha ligada', { id: t, description: START_REASON[r.skipped ?? ''] ?? r.skipped });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Função ainda na versão antiga (sem "start"): liga e o cron começa em até 5 minutos
      if (/desconhecida/i.test(msg)) {
        await supabase.from(CAMPAIGNS).update({ active: true, next_send_at: null, updated_at: new Date().toISOString() } as never).eq('id', c.id!);
        toast.success('Campanha ligada: a primeira mensagem sai em até 5 minutos', { id: t });
      } else toast.error('Não foi possível iniciar', { id: t, description: msg });
    }
    load();
  };

  if (missing) return <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">A prospecção automática ainda não está no banco. Peça ao Lovable para aplicar a migração <code>20261030230000_prospecting.sql</code>.</p>;
  if (!campaigns) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const current = campaigns.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A campanha pega as empresas (da sua prospecção Manual ou do Google) e o WhatsApp envia a sua mensagem sozinho,
          com limite por dia e intervalo aleatório. Quem responde vira lead no CRM; quem pede para parar não recebe mais nada.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PullFromManual numbers={numbers} sequences={sequences} primary onDone={(id) => { if (id) setSelected(id); load(); }} />
          <Button variant="outline" className="gap-1.5" onClick={() => setEditing({ ...EMPTY, example_message: manualTemplate(), followup_sequence_id: defaultSequence(sequences) })}><Plus className="h-4 w-4" /> Nova campanha</Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Nenhuma campanha ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em <strong className="font-medium text-foreground">Disparar da Manual</strong> e escolha o nicho que você captou: a campanha é criada sozinha com essas empresas.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <ul className="space-y-2">
            {campaigns.map((c) => {
              const s = stats[c.id!] ?? { queue: 0, sent: 0, replied: 0, today: 0 };
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id!)}
                    className={cn('w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40', selected === c.id && 'border-primary ring-1 ring-primary/30')}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', c.active ? 'bg-success' : 'bg-muted-foreground/40')} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{s.today}/{c.daily_limit} hoje</span>
                    </div>
                    <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{[c.niche, c.city].filter(Boolean).join(' · ')}</p>
                    <div className="mt-2 flex gap-3 pl-4 text-xs tabular-nums">
                      <span><strong className="font-semibold">{s.queue}</strong> <span className="text-muted-foreground">na fila</span></span>
                      <span><strong className="font-semibold">{s.sent}</strong> <span className="text-muted-foreground">enviados</span></span>
                      <span className="text-success"><strong className="font-semibold">{s.replied}</strong> responderam</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && (
            <CampaignDetail
              key={current.id}
              campaign={current}
              numbers={numbers}
              sequences={sequences}
              prospects={prospects.filter((p) => p.campaign_id === current.id)}
              stats={stats[current.id!] ?? { queue: 0, sent: 0, replied: 0, today: 0 }}
              onToggle={(v) => toggle(current, v)}
              onEdit={() => setEditing(current)}
              onChanged={load}
            />
          )}
        </div>
      )}

      {editing && (
        <CampaignEditor
          campaign={editing}
          numbers={numbers}
          sequences={sequences}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setSelected(id); load(); }}
        />
      )}
    </div>
  );
}

function CampaignDetail({ campaign: c, numbers, sequences, prospects, stats, onToggle, onEdit, onChanged }: {
  campaign: Campaign; numbers: WaNumber[]; sequences: Sequence[]; prospects: Prospect[]; stats: { queue: number; sent: number; replied: number; today: number };
  onToggle: (v: boolean) => void; onEdit: () => void; onChanged: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<Prospect | null>(null);
  const sender = numbers.find((n) => n.id === c.session_id) ?? numbers.find((n) => n.is_default);
  const followup = sequences.find((q) => q.id === c.followup_sequence_id);

  const search = async () => {
    setSearching(true);
    try {
      const r = await invoke<{ found: number; added: number; no_phone: number; closed: number; repeated: number }>({ action: 'search', campaign_id: c.id });
      toast.success(`${r.added} empresas novas na fila`, {
        description: `${r.found} encontradas no Google · ${r.no_phone} sem telefone · ${r.repeated} já estavam na lista${r.closed ? ` · ${r.closed} fechadas` : ''}`,
      });
      onChanged();
    } catch (e) { toast.error('Não foi possível buscar', { description: e instanceof Error ? e.message : '' }); }
    setSearching(false);
  };

  const discard = async (p: Prospect) => {
    await supabase.from(PROSPECTS).update({ status: 'descartado', error: 'descartado manualmente' } as never).eq('id', p.id);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Apagar a campanha "${c.name}" e a lista de empresas dela? As conversas e leads continuam no CRM.`)) return;
    await supabase.from(CAMPAIGNS).delete().eq('id', c.id!);
    onChanged();
  };

  const shown = prospects.filter((p) =>
    filter === 'all' ? true : filter === 'outros' ? ['sem_whatsapp', 'descartado', 'erro', 'nao_quer'].includes(p.status) : p.status === filter);
  const replyRate = stats.sent ? Math.round((stats.replied / stats.sent) * 100) : 0;

  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{c.name}</h2>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.city ? `${c.niche} em ${c.city}` : c.niche}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Envia por <strong className="font-medium text-foreground">{sender?.name ?? 'número principal'}</strong> · até {c.daily_limit} por dia ·
              {' '}{pacingLabel(c)} · {c.start_hour}h às {c.end_hour}h{c.weekdays_only ? ', seg a sex' : ''}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quem responder: CRM em "Contato iniciado"{followup ? <> + follow-up <strong className="font-medium text-foreground">{followup.name}</strong>{!followup.active && ' (desligado)'}</> : ', sem follow-up automático'}
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
            <Switch checked={c.active} onCheckedChange={onToggle} /> {c.active ? 'Enviando' : 'Pausada'}
          </label>
        </div>

        {c.batch_running_since && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lote sendo enviado agora ({prospects.filter((p) => p.status === 'enviando').length} na vez)
          </p>
        )}

        {sender?.is_default && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs">
            Esta campanha envia pelo número principal. Para não arriscar um bloqueio nele, conecte um chip só de prospecção em
            CRM → Números do WhatsApp e escolha ele em Editar.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Na fila', value: stats.queue },
            { label: 'Enviados hoje', value: `${stats.today}/${c.daily_limit}` },
            { label: 'Enviados', value: stats.sent },
            { label: 'Responderam', value: `${stats.replied}${stats.sent ? ` · ${replyRate}%` : ''}`, accent: true },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className={cn('text-xl font-semibold tabular-nums', m.accent && 'text-success')}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={search} disabled={searching} className="gap-1.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar empresas no Google
          </Button>
          <PullFromManual campaign={c} numbers={numbers} onDone={onChanged} />
          <SampleButton campaign={c} next={prospects.find((p) => p.status === 'novo')} />
          <Button variant="ghost" className="gap-1.5" onClick={onEdit}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={remove} aria-label="Apagar campanha"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', filter === f.id ? 'bg-primary text-primary-foreground' :'bg-muted text-muted-foreground hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {prospects.length === 0 ? 'Encha a fila com "Buscar empresas no Google" ou "Puxar da Manual".' : 'Nenhuma empresa neste filtro.'}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.slice(0, 300).map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(p)}>
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.category}{p.rating ? <> · <Star className="inline h-3 w-3 -translate-y-px fill-current" /> {p.rating} ({p.reviews})</> : null} · +{p.phone}
                </p>
              </button>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[p.status]?.tone)} title={p.error || undefined}>
                {STATUS[p.status]?.label ?? p.status}
              </span>
              {p.status === 'novo' && (
                <button onClick={() => discard(p)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted" aria-label="Tirar da fila">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>{open.name}</DialogTitle>
            <DialogDescription>{open.address}</DialogDescription>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[open.status]?.tone)}>{STATUS[open.status]?.label}</span>
                {open.sent_at && <span className="text-xs text-muted-foreground">enviado em {new Date(open.sent_at).toLocaleString('pt-BR')}</span>}
              </div>
              {open.error && <p className="text-xs text-muted-foreground">Motivo: {open.error}</p>}
              {open.message
                ? <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{open.message}</p>
                : <p className="text-xs text-muted-foreground">Vai receber a mensagem da campanha, com o nome da empresa.</p>}
              <div className="flex flex-wrap gap-2">
                {open.maps_url && <Button asChild size="sm" variant="outline" className="gap-1.5"><a href={open.maps_url} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5" /> Google Maps</a></Button>}
                {open.website && <Button asChild size="sm" variant="outline" className="gap-1.5"><a href={open.website} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Site</a></Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

/** Traz empresas da prospecção manual (por nicho) para a fila desta campanha */
/** Traz empresas da prospecção manual (por nicho) para a fila de uma campanha.
 *  Sem campanha (botão do topo), cria uma campanha para os nichos escolhidos, pausada, pelo chip de prospecção se houver. */
function PullFromManual({ campaign, numbers, sequences = [], primary, onDone }: {
  campaign?: Campaign; numbers: WaNumber[]; sequences?: Sequence[]; primary?: boolean; onDone: (campaignId?: string) => void;
}) {
  const [rows, setRows] = useState<{ id: string; category: string; status: string; phone: string | null }[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);

  const openDialog = async () => {
    const { data, error } = await supabase.from(PROSPECTS).select('id, category, status, phone').is('campaign_id', null);
    if (error) { toast.error('Não foi possível ler a prospecção manual', { description: error.message }); return; }
    setRows((data ?? []) as unknown as { id: string; category: string; status: string; phone: string | null }[]);
    setPicked([]);
  };

  // Só entra quem tem telefone e ainda não foi contatado na manual
  const groups = useMemo(() => {
    const acc: Record<string, { key: string; label: string; ready: string[]; skipped: number }> = {};
    for (const r of rows ?? []) {
      const g = (acc[nicheKey(r.category)] ??= { key: nicheKey(r.category), label: nicheLabel(r.category), ready: [], skipped: 0 });
      if (r.phone && r.status === 'novo') g.ready.push(r.id); else g.skipped++;
    }
    return Object.values(acc).sort((a, b) => b.ready.length - a.ready.length);
  }, [rows]);

  const total = groups.filter((g) => picked.includes(g.key)).reduce((n, g) => n + g.ready.length, 0);

  const move = async () => {
    const chosen = groups.filter((g) => picked.includes(g.key));
    const ids = chosen.flatMap((g) => g.ready);
    setMoving(true);
    let target = campaign;
    if (!target) {
      const niche = chosen.map((g) => g.label).join(', ');
      const sender = numbers.find((n) => !n.is_default) ?? numbers.find((n) => n.is_default);
      const { data: u } = await supabase.auth.getUser();
      const row = {
        ...EMPTY, name: niche, niche, city: '', session_id: sender?.id ?? null, active: false, created_by: u.user?.id ?? null,
        example_message: manualTemplate(),
        ...(defaultSequence(sequences) ? { followup_sequence_id: defaultSequence(sequences) } : {}),
      };
      let { data, error } = await supabase.from(CAMPAIGNS).insert(row as never).select('*').single();
      // Migração do follow-up ainda não aplicada: cria sem ele
      if (error && /followup_sequence_id/.test(error.message)) {
        const { followup_sequence_id: _skip, ...rest } = row as typeof row & { followup_sequence_id?: string };
        ({ data, error } = await supabase.from(CAMPAIGNS).insert(rest as never).select('*').single());
      }
      if (error) { toast.error('Não foi possível criar a campanha', { description: error.message }); setMoving(false); return; }
      target = data as unknown as Campaign;
    }
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from(PROSPECTS).update({ campaign_id: target.id, status: 'novo', error: '' } as never).in('id', ids.slice(i, i + 200));
      if (error) { toast.error('Não foi possível puxar', { description: error.message }); setMoving(false); return; }
    }
    setMoving(false);
    setRows(null);
    toast.success(`${ids.length} empresas na fila de "${target.name}"`, {
      description: campaign ? 'Elas saem da lista manual e entram no disparo automático.' : 'Campanha criada pausada com a sua mensagem da Manual. Confira em Editar e ligue quando quiser começar.',
    });
    onDone(target.id);
  };

  return (
    <>
      <Button variant={primary ? 'default' : 'outline'} onClick={openDialog} className="gap-1.5">
        <Download className="h-4 w-4" /> {campaign ? 'Puxar da Manual' : 'Disparar da Manual'}
      </Button>
      {rows && (
        <Dialog open onOpenChange={(o) => !o && setRows(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>{campaign ? 'Puxar da prospecção manual' : 'Disparar da prospecção manual'}</DialogTitle>
            <DialogDescription>
              Escolha os nichos. Entram {campaign ? 'na fila desta campanha' : 'numa campanha nova'} as empresas com telefone que ainda estão como "Novo" na manual.
            </DialogDescription>
            {groups.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">A lista manual está vazia.</p>
            ) : (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {groups.map((g) => {
                  const on = picked.includes(g.key);
                  return (
                    <li key={g.key}>
                      <button
                        disabled={!g.ready.length}
                        onClick={() => setPicked((p) => (on ? p.filter((k) => k !== g.key) : [...p, g.key]))}
                        className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50',
                          on ? 'border-primary bg-primary/10' : 'hover:border-primary/40')}
                      >
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]', on && 'border-primary bg-primary text-primary-foreground')}>{on && '✓'}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.label}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          <strong className="font-semibold text-foreground">{g.ready.length}</strong> prontas{g.skipped ? ` · ${g.skipped} fora` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">"Fora" são as sem telefone ou que você já marcou como contatado, interessado ou fechado.</p>
            <Button onClick={move} disabled={!total || moving} className="w-full">
              {moving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {total ? `Puxar ${total} empresa${total > 1 ? 's' : ''} para a fila` : 'Escolha um nicho'}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Mostra como a mensagem da campanha fica para a próxima empresa da fila (não envia) */
function SampleButton({ campaign, next }: { campaign: Campaign; next?: { name: string; category: string } }) {
  const [message, setMessage] = useState<string | null>(null);
  const target = next ?? { name: 'Clínica Exemplo', category: campaign.niche };
  const run = () => {
    if (!campaign.example_message.trim()) { toast.error('Escreva a mensagem da campanha em Editar'); return; }
    setMessage(renderMessage(campaign, target));
  };
  const hasVariations = /\{[^{}]*\|[^{}]*\}/.test(campaign.example_message);
  return (
    <>
      <Button variant="outline" onClick={run} className="gap-1.5"><Eye className="h-4 w-4" /> Ver como fica</Button>
      {message !== null && (
        <Dialog open onOpenChange={(o) => !o && setMessage(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Mensagem para {target.name}</DialogTitle>
            <DialogDescription>É exatamente o que a empresa recebe. Nada foi enviado.</DialogDescription>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{message}</p>
            {hasVariations && <Button variant="outline" onClick={run} className="gap-1.5"><Shuffle className="h-4 w-4" /> Ver outra variação</Button>}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CampaignEditor({ campaign, numbers, sequences, onClose, onSaved }: {
  campaign: Campaign; numbers: WaNumber[]; sequences: Sequence[]; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [d, setD] = useState<Campaign>(campaign);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

  const save = async () => {
    if (!d.niche.trim()) { toast.error('Preencha o nicho'); return; }
    if (!d.example_message.trim()) { toast.error('Escreva a mensagem que será enviada'); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const row = {
      name: d.name.trim() || [d.niche.trim(), d.city.trim()].filter(Boolean).join(' · '), niche: d.niche.trim(), city: d.city.trim(),
      session_id: d.session_id, pitch: d.pitch.trim(), example_message: d.example_message.trim(),
      daily_limit: d.daily_limit, min_gap_min: d.min_gap_min, max_gap_min: Math.max(d.min_gap_min, d.max_gap_min),
      start_hour: d.start_hour, end_hour: Math.max(d.start_hour + 1, d.end_hour), weekdays_only: d.weekdays_only,
      updated_at: new Date().toISOString(),
      followup_sequence_id: d.followup_sequence_id ?? null,
      ...(d.send_mode ? {
        send_mode: d.send_mode, batch_size: d.batch_size ?? 20, batch_pause_min: d.batch_pause_min ?? 5,
        batch_min_sec: d.batch_min_sec ?? 8, batch_max_sec: Math.max(d.batch_min_sec ?? 8, d.batch_max_sec ?? 20),
      } : {}),
    };
    const write = (r: Record<string, unknown>) => d.id
      ? supabase.from(CAMPAIGNS).update(r as never).eq('id', d.id).select('id').single()
      : supabase.from(CAMPAIGNS).insert({ ...r, active: false, created_by: u.user?.id ?? null } as never).select('id').single();
    let res = await write(row);
    // Migração ainda não aplicada (follow-up ou lotes): salva o resto e avisa
    if (res.error && /followup_sequence_id|send_mode|batch_/.test(res.error.message)) {
      const rest = Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'followup_sequence_id' && k !== 'send_mode' && !k.startsWith('batch_')));
      res = await write(rest);
      if (!res.error) toast.warning('Follow-up e envio em lotes não foram salvos', { description: 'Peça ao Lovable para aplicar as migrações 20261030235000_prospect_followup.sql e 20261031000000_prospect_batches.sql.' });
    }
    setSaving(false);
    if (res.error) { toast.error('Não foi possível salvar', { description: res.error.message }); return; }
    toast.success(d.id ? 'Campanha salva' : 'Campanha criada', { description: d.id ? undefined : 'Agora busque as empresas no Google e ligue a campanha.' });
    onSaved((res.data as unknown as { id: string }).id);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b p-5">
          <SheetTitle>{d.id ? 'Editar campanha' : 'Nova campanha'}</SheetTitle>
          <SheetDescription>Quem buscar no Google, o que oferecer e o ritmo dos envios.</SheetDescription>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nicho</Label>
              <Input value={d.niche} onChange={(e) => set('niche', e.target.value)} placeholder="clínica de estética" /></div>
            <div className="space-y-1.5"><Label>Cidade <span className="font-normal text-muted-foreground">(para buscar no Google)</span></Label>
              <Input value={d.city} onChange={(e) => set('city', e.target.value)} placeholder="Volta Redonda, RJ" /></div>
          </div>
          <div className="space-y-1.5"><Label>Nome da campanha</Label>
            <Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder={d.niche ? `${d.niche} · ${d.city}` : 'Opcional'} /></div>

          <div className="space-y-1.5"><Label>Número que envia</Label>
            <Select value={d.session_id ?? ''} onValueChange={(v) => set('session_id', v)}>
              <SelectTrigger><SelectValue placeholder="Escolher número" /></SelectTrigger>
              <SelectContent>{numbers.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}{n.is_default ? ' (principal)' : ''}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Use um chip só de prospecção (conecte em CRM → Números do WhatsApp).</p>
          </div>

          <div className="space-y-1.5"><Label>Mensagem que será enviada</Label>
            <Textarea rows={7} value={d.example_message} onChange={(e) => set('example_message', e.target.value)}
              placeholder={'{Oi|Olá}! Tudo bem? Aqui é da INOVA 👋\nVi o trabalho da {empresa} e achei incrível!\nPosso te mandar alguns resultados que tivemos com clientes parecidos?'} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <code className="rounded bg-muted px-1">{'{empresa}'}</code> vira o nome da empresa · <code className="rounded bg-muted px-1">{'{nicho}'}</code> o nicho ·{' '}
              <code className="rounded bg-muted px-1">{'{cidade}'}</code> a cidade. Para variar o texto e diminuir o risco de bloqueio, escreva opções entre chaves:{' '}
              <code className="rounded bg-muted px-1">{'{Oi|Olá|Bom dia}'}</code> — cada empresa recebe uma delas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Follow-up de quem responder</Label>
            <Select value={d.followup_sequence_id ?? 'none'} onValueChange={(v) => set('followup_sequence_id', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem follow-up automático</SelectItem>
                {sequences.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.name} · {q.steps.length} mensagens{q.active ? '' : ' (desligada)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quem responder vai para "Contato iniciado" no CRM e entra nessa sequência. Ela para sozinha quando a pessoa responder de novo.
              Crie e edite as sequências em CRM → Follow-up.
            </p>
            {sequences.find((q) => q.id === d.followup_sequence_id && !q.active) && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs">Esta sequência está desligada: os leads entram nela, mas as mensagens só saem quando você ligar em CRM → Follow-up.</p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Ritmo dos envios</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {([['um_por_vez', 'Um por vez', 'Intervalo de minutos'], ['lotes', 'Em lotes', 'Várias seguidas e pausa']] as const).map(([mode, label, hint]) => (
                <button key={mode} type="button" onClick={() => setD((x) => ({ ...BATCH_DEFAULTS, ...x, send_mode: mode, daily_limit: mode === 'lotes' && x.daily_limit < 40 ? 100 : x.daily_limit }))}
                  className={cn('rounded-md px-3 py-2 text-left transition-colors', (d.send_mode ?? 'um_por_vez') === mode ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Máximo por dia</Label>
                <Input type="number" min={1} max={500} value={d.daily_limit} onChange={(e) => set('daily_limit', num(e.target.value, 1, 500))} /></div>
              {isBatch(d) ? (
                <>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Mensagens por lote</Label>
                    <Input type="number" min={1} max={50} value={d.batch_size ?? 20} onChange={(e) => set('batch_size', num(e.target.value, 1, 50))} /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Pausa entre lotes (min)</Label>
                    <Input type="number" min={1} max={240} value={d.batch_pause_min ?? 5} onChange={(e) => set('batch_pause_min', num(e.target.value, 1, 240))} /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo mín. (seg)</Label>
                    <Input type="number" min={3} max={300} value={d.batch_min_sec ?? 8} onChange={(e) => set('batch_min_sec', num(e.target.value, 3, 300))} /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo máx. (seg)</Label>
                    <Input type="number" min={3} max={600} value={d.batch_max_sec ?? 20} onChange={(e) => set('batch_max_sec', num(e.target.value, 3, 600))} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo mín. (min)</Label>
                    <Input type="number" min={3} max={120} value={d.min_gap_min} onChange={(e) => set('min_gap_min', num(e.target.value, 3, 120))} /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo máx. (min)</Label>
                    <Input type="number" min={3} max={180} value={d.max_gap_min} onChange={(e) => set('max_gap_min', num(e.target.value, 3, 180))} /></div>
                </>
              )}
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Começa às (h)</Label>
                <Input type="number" min={6} max={22} value={d.start_hour} onChange={(e) => set('start_hour', num(e.target.value, 6, 22))} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Para às (h)</Label>
                <Input type="number" min={7} max={23} value={d.end_hour} onChange={(e) => set('end_hour', num(e.target.value, 7, 23))} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={d.weekdays_only} onCheckedChange={(v) => set('weekdays_only', v)} /> Só seg a sex</label>
            </div>
            {isBatch(d) ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs">
                Em lotes o WhatsApp percebe o volume mais rápido: use um chip só de prospecção, varie o texto com {'{Oi|Olá}'} e comece com lotes menores
                (ex.: 10 a cada 15 min) em chip novo. Antes de cada mensagem o número aparece "digitando…".
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Chip novo: comece com 15–20 por dia e aumente aos poucos. Acima de 50 por dia o risco de bloqueio cresce bastante.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
