import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
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

type Campaign = {
  id?: string; name: string; niche: string; city: string; session_id: string | null; pitch: string; example_message: string;
  daily_limit: number; min_gap_min: number; max_gap_min: number; start_hour: number; end_hour: number;
  weekdays_only: boolean; active: boolean; last_search_at?: string | null;
};
type Prospect = {
  id: string; campaign_id: string; name: string; phone: string; address: string; category: string; rating: number | null;
  reviews: number | null; website: string; maps_url: string; status: string; message: string; error: string;
  sent_at: string | null; replied_at: string | null; lead_id: string | null;
};
type WaNumber = { id: string; name: string; is_default: boolean };

const CAMPAIGNS = 'prospect_campaigns' as never;
const PROSPECTS = 'prospects' as never;

const STATUS: Record<string, { label: string; tone: string }> = {
  novo: { label: 'Na fila', tone: 'bg-muted text-muted-foreground' },
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
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    const [{ data: c, error }, { data: p }, { data: n }] = await Promise.all([
      supabase.from(CAMPAIGNS).select('*').order('created_at'),
      supabase.from(PROSPECTS).select('*').not('campaign_id', 'is', null).order('created_at', { ascending: false }).limit(2000),
      supabase.from('wa_numbers' as never).select('id, name, is_default').order('name'),
    ]);
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
    const { error } = await supabase.from(CAMPAIGNS).update({ active, updated_at: new Date().toISOString() } as never).eq('id', c.id!);
    if (error) { toast.error('Não foi possível salvar'); load(); return; }
    toast.success(active ? 'Campanha ligada: os envios começam no próximo horário permitido' : 'Campanha pausada');
  };

  if (missing) return <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">A prospecção automática ainda não está no banco. Peça ao Lovable para aplicar a migração <code>20261030230000_prospecting.sql</code>.</p>;
  if (!campaigns) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const current = campaigns.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A campanha busca empresas no Google, a IA escreve uma mensagem diferente para cada uma e o WhatsApp envia sozinho,
          com limite por dia e intervalo aleatório. Quem responde vira lead no CRM; quem pede para parar não recebe mais nada.
        </p>
        <Button className="shrink-0 gap-1.5" onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> Nova campanha</Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Nenhuma campanha ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie uma campanha com o ramo e a cidade (ex.: "clínica de estética" em "Volta Redonda, RJ").</p>
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
                    <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{c.niche} · {c.city}</p>
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
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setSelected(id); load(); }}
        />
      )}
    </div>
  );
}

function CampaignDetail({ campaign: c, numbers, prospects, stats, onToggle, onEdit, onChanged }: {
  campaign: Campaign; numbers: WaNumber[]; prospects: Prospect[]; stats: { queue: number; sent: number; replied: number; today: number };
  onToggle: (v: boolean) => void; onEdit: () => void; onChanged: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<Prospect | null>(null);
  const sender = numbers.find((n) => n.id === c.session_id) ?? numbers.find((n) => n.is_default);

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
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.niche} em {c.city}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Envia por <strong className="font-medium text-foreground">{sender?.name ?? 'número principal'}</strong> · até {c.daily_limit} por dia ·
              a cada {c.min_gap_min}–{c.max_gap_min} min · {c.start_hour}h às {c.end_hour}h{c.weekdays_only ? ', seg a sex' : ''}
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
            <Switch checked={c.active} onCheckedChange={onToggle} /> {c.active ? 'Enviando' : 'Pausada'}
          </label>
        </div>

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
          <SampleButton campaign={c} />
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
          {prospects.length === 0 ? 'Clique em "Buscar empresas no Google" para encher a fila.' : 'Nenhuma empresa neste filtro.'}
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
                : <p className="text-xs text-muted-foreground">A mensagem é escrita pela IA na hora do envio.</p>}
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

/** Mostra uma mensagem que a IA escreveria para a próxima empresa da fila (não envia) */
function SampleButton({ campaign }: { campaign: Campaign }) {
  const [state, setState] = useState<{ prospect: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try { setState(await invoke({ action: 'sample', campaign_id: campaign.id, draft: campaign.id ? undefined : campaign })); }
    catch (e) { toast.error('Não foi possível gerar', { description: e instanceof Error ? e.message : '' }); }
    setLoading(false);
  };
  return (
    <>
      <Button variant="outline" onClick={run} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ver mensagem de exemplo
      </Button>
      {state && (
        <Dialog open onOpenChange={(o) => !o && setState(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Exemplo para {state.prospect}</DialogTitle>
            <DialogDescription>Cada empresa recebe um texto diferente, escrito na hora do envio. Nada foi enviado.</DialogDescription>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{state.message}</p>
            <Button variant="outline" onClick={run} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar outra
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CampaignEditor({ campaign, numbers, onClose, onSaved }: {
  campaign: Campaign; numbers: WaNumber[]; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [d, setD] = useState<Campaign>(campaign);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

  const save = async () => {
    if (!d.niche.trim() || !d.city.trim()) { toast.error('Preencha o ramo e a cidade'); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const row = {
      name: d.name.trim() || `${d.niche.trim()} · ${d.city.trim()}`, niche: d.niche.trim(), city: d.city.trim(),
      session_id: d.session_id, pitch: d.pitch.trim(), example_message: d.example_message.trim(),
      daily_limit: d.daily_limit, min_gap_min: d.min_gap_min, max_gap_min: Math.max(d.min_gap_min, d.max_gap_min),
      start_hour: d.start_hour, end_hour: Math.max(d.start_hour + 1, d.end_hour), weekdays_only: d.weekdays_only,
      updated_at: new Date().toISOString(),
    };
    const res = d.id
      ? await supabase.from(CAMPAIGNS).update(row as never).eq('id', d.id).select('id').single()
      : await supabase.from(CAMPAIGNS).insert({ ...row, active: false, created_by: u.user?.id ?? null } as never).select('id').single();
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
            <div className="space-y-1.5"><Label>Ramo (o que buscar)</Label>
              <Input value={d.niche} onChange={(e) => set('niche', e.target.value)} placeholder="clínica de estética" /></div>
            <div className="space-y-1.5"><Label>Cidade</Label>
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

          <div className="space-y-1.5"><Label>O que oferecer (instruções para a IA)</Label>
            <Textarea rows={3} value={d.pitch} onChange={(e) => set('pitch', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Mensagem de referência <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea rows={4} value={d.example_message} onChange={(e) => set('example_message', e.target.value)}
              placeholder="Uma mensagem no seu jeito de falar. A IA mantém a ideia e escreve diferente para cada empresa." /></div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Ritmo dos envios</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Máximo por dia</Label>
                <Input type="number" min={1} max={80} value={d.daily_limit} onChange={(e) => set('daily_limit', num(e.target.value, 1, 80))} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo mín. (min)</Label>
                <Input type="number" min={3} max={120} value={d.min_gap_min} onChange={(e) => set('min_gap_min', num(e.target.value, 3, 120))} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo máx. (min)</Label>
                <Input type="number" min={3} max={180} value={d.max_gap_min} onChange={(e) => set('max_gap_min', num(e.target.value, 3, 180))} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Começa às (h)</Label>
                <Input type="number" min={6} max={22} value={d.start_hour} onChange={(e) => set('start_hour', num(e.target.value, 6, 22))} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Para às (h)</Label>
                <Input type="number" min={7} max={23} value={d.end_hour} onChange={(e) => set('end_hour', num(e.target.value, 7, 23))} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={d.weekdays_only} onCheckedChange={(v) => set('weekdays_only', v)} /> Só seg a sex</label>
            </div>
            <p className="text-xs text-muted-foreground">Chip novo: comece com 15–20 por dia e aumente aos poucos. Acima de 50 por dia o risco de bloqueio cresce bastante.</p>
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
