import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarClock, Eye, History, Loader2, Megaphone, MessageCircle, Pencil, Plus, Send, Trash2, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  CLIENT_VARS, TRIGGERS, WEEKDAYS, sampleRender, scheduleLabel,
  type Automation, type AutomationLog, type TriggerKey,
} from '@/lib/waAutomations';

// Tabelas novas: ainda fora dos tipos gerados do Supabase
const AUTOMATIONS = 'wa_automations' as never;
const LOGS = 'wa_automation_logs' as never;

type Client = { id: string; company_name: string };
type Group = { id: string; name: string };
type Tab = 'automacoes' | 'disparos' | 'historico';

const DESTINATIONS = {
  group_then_phone: 'Grupo do cliente (ou telefone, se não tiver grupo)',
  group: 'Só no grupo do cliente',
  phone: 'Só no telefone do cliente',
};

const emptyDraft = (trigger: TriggerKey): Partial<Automation> => ({
  name: trigger === 'manual' ? 'Novo disparo' : TRIGGERS[trigger].label,
  description: '', trigger, enabled: trigger === 'manual', template: '',
  days_of_week: [1, 2, 3, 4, 5], send_time: '10:00',
  params: Object.fromEntries(TRIGGERS[trigger].params.map((p) => [p.key, p.default])),
  audience: TRIGGERS[trigger].audience === 'team' ? { type: 'team', to: '' } : { type: 'all' },
  destination: 'group_then_phone', scheduled_at: null,
});

export default function WhatsAppAutomationsPage() {
  const [tab, setTab] = useState<Tab>('automacoes');
  const [items, setItems] = useState<Automation[] | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [editing, setEditing] = useState<Partial<Automation> | null>(null);
  const [preview, setPreview] = useState<{ title: string; total: number; items: { client: string; destination: string; message: string }[] } | null>(null);
  const [conn, setConn] = useState<{ status: string; number: string | null } | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: l }, { data: c }] = await Promise.all([
      supabase.from(AUTOMATIONS).select('*').order('created_at'),
      supabase.from(LOGS).select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('clients').select('id, company_name').is('deleted_at', null).eq('status', 'Ativo').order('company_name'),
    ]);
    setMissingTable(!!error);
    setItems(((data ?? []) as unknown as Automation[]));
    setLogs(((l ?? []) as unknown as AutomationLog[]));
    setClients((c ?? []) as Client[]);
  }, []);

  useEffect(() => {
    load();
    supabase.functions.invoke('wa-server', { body: { action: 'status' } })
      .then(({ data }) => setConn(data?.status ? data : { status: 'OFFLINE', number: null }));
  }, [load]);

  const automations = (items ?? []).filter((a) => a.trigger !== 'manual');
  const broadcasts = (items ?? []).filter((a) => a.trigger === 'manual');
  const sentCount = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000;
    const m: Record<string, number> = {};
    logs.forEach((l) => { if (l.status === 'enviado' && l.automation_id && new Date(l.created_at).getTime() > since) m[l.automation_id] = (m[l.automation_id] ?? 0) + 1; });
    return m;
  }, [logs]);

  const toggle = async (a: Automation, enabled: boolean) => {
    setItems((list) => list?.map((x) => (x.id === a.id ? { ...x, enabled } : x)) ?? null);
    const { error } = await supabase.from(AUTOMATIONS).update({ enabled, updated_at: new Date().toISOString() } as never).eq('id', a.id);
    if (error) { toast.error('Não foi possível salvar'); load(); return; }
    toast.success(enabled ? `"${a.name}" ligada` : `"${a.name}" desligada`);
  };

  const remove = async (a: Automation) => {
    if (!confirm(`Excluir "${a.name}"?`)) return;
    await supabase.from(AUTOMATIONS).delete().eq('id', a.id);
    load();
  };

  const runPreview = async (a: Partial<Automation>) => {
    const { data, error } = await supabase.functions.invoke('wa-automations', {
      body: { action: 'preview', automation_id: a.id, draft: a },
    });
    if (error || data?.error) { toast.error('Não foi possível simular', { description: data?.error ?? 'Função ainda não publicada no Lovable.' }); return; }
    setPreview({ title: a.name ?? 'Prévia', total: data.total, items: data.items });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="WhatsApp"
        title="Automações"
        description="Mensagens que saem sozinhas pelo WhatsApp da INOVA: escolha quando, para quem e o texto."
        actions={<ConnectionPill conn={conn} />}
      />

      {missingTable && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          As automações ainda não estão no banco. Peça ao Lovable para aplicar a migração <code className="text-xs">20261030130000_whatsapp_automations.sql</code> e fazer o deploy da função <code className="text-xs">wa-automations</code>.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {([['automacoes', 'Automações', Zap], ['disparos', 'Disparos', Megaphone], ['historico', 'Histórico', History]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
                tab === k ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>
        {tab === 'automacoes' && <NewAutomationButton onPick={(t) => setEditing(emptyDraft(t))} />}
        {tab === 'disparos' && <Button className="gap-1.5" onClick={() => setEditing(emptyDraft('manual'))}><Plus className="h-4 w-4" /> Novo disparo</Button>}
      </div>

      {!items ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : tab === 'automacoes' ? (
        <div className="space-y-6">
          {(['Cliente', 'Financeiro', 'Produção', 'Equipe'] as const).map((group) => {
            const list = automations.filter((a) => TRIGGERS[a.trigger]?.group === group);
            if (!list.length) return null;
            return (
              <section key={group} className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group}</h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {list.map((a) => (
                    <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {scheduleLabel(a)}
                          {TRIGGERS[a.trigger].audience === 'team' ? ' · grupo da equipe' : ` · ${a.audience?.type === 'clients' ? `${a.audience.client_ids?.length ?? 0} clientes` : 'todos os clientes ativos'}`}
                          {sentCount[a.id] ? ` · ${sentCount[a.id]} enviadas em 30 dias` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => runPreview(a)}><Eye className="h-3.5 w-3.5" /> Simular</Button>
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                        <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a, v)} aria-label={a.enabled ? 'Desligar' : 'Ligar'} className="ml-2" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {automations.length === 0 && !missingTable && <p className="text-sm text-muted-foreground">Nenhuma automação ainda. Crie a primeira em "Nova automação".</p>}
        </div>
      ) : tab === 'disparos' ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {broadcasts.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum disparo ainda. Use para avisos como feriados, recesso ou novidades.</li>}
          {[...broadcasts].reverse().map((a) => (
            <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.sent_at ? `Enviado em ${new Date(a.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : `Agendado: ${scheduleLabel(a)}`}
                  {' · '}{a.audience?.type === 'clients' ? `${a.audience.client_ids?.length ?? 0} clientes` : 'todos os clientes ativos'}
                  {sentCount[a.id] ? ` · ${sentCount[a.id]} enviadas` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => runPreview(a)}><Eye className="h-3.5 w-3.5" /> Simular</Button>
                {!a.sent_at && <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>}
                {!a.sent_at && <Button size="sm" variant="ghost" onClick={() => remove(a)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <HistoryList logs={logs} automations={items} clients={clients} />
      )}

      {editing && (
        <AutomationEditor
          draft={editing} clients={clients}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onPreview={runPreview}
        />
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogTitle>Simulação: {preview?.title}</DialogTitle>
          <DialogDescription>
            {preview?.total ? `Se rodasse agora, ${preview.total} ${preview.total === 1 ? 'mensagem sairia' : 'mensagens sairiam'}. Nada foi enviado.` : 'Se rodasse agora, nenhuma mensagem sairia.'}
          </DialogDescription>
          <ul className="space-y-3">
            {preview?.items.map((it, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">{it.client}</span>
                  <span className={cn(it.destination === 'sem contato' ? 'text-warning' : 'text-muted-foreground')}>{it.destination}</span>
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground/85">{it.message}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionPill({ conn }: { conn: { status: string; number: string | null } | null }) {
  if (!conn) return <span className="flex h-9 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando WhatsApp…</span>;
  const ok = conn.status === 'CONNECTED';
  return (
    <span className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium', ok ? 'border-success/40 text-success' : 'border-warning/40 text-warning')}>
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-success' : 'bg-warning')} />
      {ok ? `Conectado${conn.number ? ` · +${conn.number}` : ''}` : conn.status === 'OFFLINE' ? 'Servidor fora do ar' : 'WhatsApp desconectado'}
    </span>
  );
}

function NewAutomationButton({ onPick }: { onPick: (t: TriggerKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Nova automação</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {(Object.entries(TRIGGERS) as [TriggerKey, (typeof TRIGGERS)[TriggerKey]][]).filter(([k]) => k !== 'manual').map(([k, t]) => (
          <DropdownMenuItem key={k} onSelect={() => onPick(k)} className="flex-col items-start gap-0">
            <span className="text-sm font-medium">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.group}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HistoryList({ logs, automations, clients }: { logs: AutomationLog[]; automations: Automation[]; clients: Client[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const name = Object.fromEntries(automations.map((a) => [a.id, a.name]));
  const client = Object.fromEntries(clients.map((c) => [c.id, c.company_name]));
  const tone = { enviado: 'text-success', teste: 'text-primary', sem_contato: 'text-warning', erro: 'text-destructive' } as const;
  const label = { enviado: 'Enviada', teste: 'Teste', sem_contato: 'Sem contato', erro: 'Erro' } as const;
  if (!logs.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {logs.map((l) => (
        <li key={l.id}>
          <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.03]">
            <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
              {new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{(l.client_id && client[l.client_id]) || (l.status === 'teste' ? l.recipient : 'Equipe')}</span>
              <span className="text-muted-foreground"> · {(l.automation_id && name[l.automation_id]) || 'Teste'}</span>
            </span>
            <span className={cn('shrink-0 text-xs font-medium', tone[l.status])}>{label[l.status]}</span>
          </button>
          {open === l.id && (
            <div className="space-y-2 px-4 pb-4">
              <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{l.message}</p>
              {l.error && <p className="text-xs text-destructive">{l.error}</p>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AutomationEditor({ draft: initial, clients, onClose, onSaved, onPreview }: {
  draft: Partial<Automation>; clients: Client[]; onClose: () => void; onSaved: () => void; onPreview: (a: Partial<Automation>) => void;
}) {
  const [d, setD] = useState<Partial<Automation>>(initial);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const trigger = d.trigger as TriggerKey;
  const meta = TRIGGERS[trigger];
  const isManual = trigger === 'manual';
  const set = (patch: Partial<Automation>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (meta.audience !== 'team') return;
    supabase.functions.invoke('wa-server', { body: { action: 'groups' } }).then(({ data }) => setGroups(data?.groups ?? []));
  }, [meta.audience]);

  const insertVar = (key: string) => {
    const el = textRef.current;
    const text = d.template ?? '';
    const pos = el?.selectionStart ?? text.length;
    set({ template: `${text.slice(0, pos)}{${key}}${text.slice(pos)}` });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + key.length + 2, pos + key.length + 2); });
  };

  const scheduledLocal = d.scheduled_at ? new Date(new Date(d.scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  const valid = !!d.name?.trim() && !!d.template?.trim() && (!isManual || !!d.scheduled_at)
    && (meta.audience !== 'team' || !!d.audience?.to) && (d.audience?.type !== 'clients' || (d.audience.client_ids?.length ?? 0) > 0);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const row = { ...d, updated_at: new Date().toISOString() } as Record<string, unknown>;
    delete row.id; delete row.created_at; delete row.last_run_at; delete row.sent_at;
    const { error } = d.id
      ? await supabase.from(AUTOMATIONS).update(row as never).eq('id', d.id)
      : await supabase.from(AUTOMATIONS).insert({ ...row, created_by: u.user?.id ?? null } as never);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar', { description: (error as { message: string }).message }); return; }
    toast.success(isManual ? 'Disparo agendado' : 'Automação salva');
    onSaved();
  };

  const test = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('wa-automations', { body: { action: 'test', automation_id: d.id, draft: d, to: testPhone } });
    setTesting(false);
    if (error || data?.error) { toast.error('Teste não enviado', { description: data?.error ?? 'Função ainda não publicada no Lovable.' }); return; }
    toast.success('Teste enviado', { description: data.sample_from ? `Com os dados de ${data.sample_from}` : 'Com dados de exemplo' });
  };

  const selected = new Set(d.audience?.client_ids ?? []);
  const toggleClient = (id: string) => {
    const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id);
    set({ audience: { type: 'clients', client_ids: [...next] } });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b p-5">
          <SheetTitle>{d.id ? 'Editar' : isManual ? 'Novo disparo' : 'Nova automação'}</SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <Field label="Nome"><Input value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></Field>

          {meta.params.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {meta.params.map((p) => (
                <Field key={p.key} label={p.label}>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={p.key === 'day_of_month' ? 28 : 60} className="w-24"
                      value={d.params?.[p.key] ?? p.default}
                      onChange={(e) => set({ params: { ...d.params, [p.key]: Number(e.target.value) || p.default } })} />
                    <span className="text-sm text-muted-foreground">{p.suffix}</span>
                  </div>
                </Field>
              ))}
            </div>
          )}

          {/* Quando */}
          {isManual ? (
            <Field label="Enviar em">
              <Input type="datetime-local" value={scheduledLocal}
                onChange={(e) => set({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </Field>
          ) : (
            <div className="space-y-2">
              {meta.schedule === 'weekly' && (
                <Field label="Dias">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((w, i) => {
                      const on = d.days_of_week?.includes(i);
                      return (
                        <button key={w} type="button"
                          onClick={() => set({ days_of_week: on ? d.days_of_week!.filter((x) => x !== i) : [...(d.days_of_week ?? []), i] })}
                          className={cn('h-9 w-11 rounded-md border text-sm font-medium transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}>
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
              <Field label="Horário (Brasília)">
                <Input type="time" className="w-32" value={d.send_time?.slice(0, 5) ?? '10:00'} onChange={(e) => set({ send_time: e.target.value })} />
              </Field>
            </div>
          )}

          {/* Para quem */}
          {meta.audience === 'team' ? (
            <Field label="Enviar para (grupo ou número da equipe)">
              {groups && groups.length > 0 ? (
                <Select value={d.audience?.to ?? ''} onValueChange={(v) => set({ audience: { type: 'team', to: v, to_name: groups.find((g) => g.id === v)?.name } })}>
                  <SelectTrigger><SelectValue placeholder="Escolher grupo da equipe" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder="Telefone com DDD, ex.: 24 99999-9999" value={d.audience?.to ?? ''} onChange={(e) => set({ audience: { type: 'team', to: e.target.value } })} />
              )}
            </Field>
          ) : (
            <div className="space-y-3">
              <Field label="Clientes">
                <Select value={d.audience?.type === 'clients' ? 'clients' : 'all'}
                  onValueChange={(v) => set({ audience: v === 'all' ? { type: 'all' } : { type: 'clients', client_ids: d.audience?.client_ids ?? [] } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes ativos</SelectItem>
                    <SelectItem value="clients">Escolher clientes</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {d.audience?.type === 'clients' && (
                <div className="rounded-lg border">
                  <div className="border-b p-2"><Input placeholder={`Procurar (${selected.size} escolhidos)`} value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} /></div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {clients.filter((c) => c.company_name.toLowerCase().includes(clientSearch.toLowerCase())).map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-muted">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleClient(c.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                        {c.company_name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Field label="Onde enviar">
                <Select value={d.destination ?? 'group_then_phone'} onValueChange={(v) => set({ destination: v as Automation['destination'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DESTINATIONS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* Mensagem */}
          <Field label="Mensagem">
            <Textarea ref={textRef} value={d.template ?? ''} onChange={(e) => set({ template: e.target.value })}
              className="min-h-[180px] font-mono text-[13px] leading-relaxed" placeholder="Escreva a mensagem. Use *negrito* e as variáveis abaixo." />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...(meta.audience === 'team' ? [] : CLIENT_VARS), ...meta.vars].map((v) => (
                <button key={v.key} type="button" onClick={() => insertVar(v.key)} title={v.label}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          </Field>

          {d.template?.trim() && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Prévia com dados de exemplo</p>
              <div className="rounded-xl bg-[#e7ffdb] p-3 text-sm text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
                <p className="whitespace-pre-wrap">{sampleRender(d.template, trigger)}</p>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">Testar no seu WhatsApp</p>
            <div className="flex gap-2">
              <Input placeholder="Seu telefone com DDD" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} inputMode="tel" />
              <Button variant="outline" className="shrink-0 gap-1.5" onClick={test} disabled={testing || testPhone.replace(/\D/g, '').length < 10 || !d.template?.trim()}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Testar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Manda a mensagem com os dados do primeiro cliente que receberia, só para você.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" className="gap-1.5" onClick={() => onPreview(d)} disabled={!d.template?.trim()}>
            <Eye className="h-4 w-4" /> Simular quem recebe
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isManual ? <CalendarClock className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              {isManual ? 'Agendar disparo' : 'Salvar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
