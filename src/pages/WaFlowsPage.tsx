import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Loader2, Pencil, Plus, Send, Trash2, Users, Workflow, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StepList } from '@/components/flows/FlowCanvas';
import { useKanbanStages } from '@/hooks/useKanbanStages';
import { cn } from '@/lib/utils';
import {
  RUN_STATUS, TRIGGERS, countSteps, flowIssues, prospectTemplate,
  type FlowRun, type FlowTrigger, type WaFlow,
} from '@/lib/waFlows';

// Tabelas novas, ainda fora dos tipos gerados do Supabase
const table = (t: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(t);
type WaNumber = { id: string; name: string; is_default: boolean };
type Draft = Omit<WaFlow, 'id' | 'created_at' | 'updated_at'> & { id?: string };

const blank = (): Draft => ({ name: 'Novo fluxo', enabled: false, session_id: null, trigger: 'first_reply', trigger_config: { once: true }, steps: [] });

/** Lê a mensagem de erro real da função (em respostas de erro o supabase-js não preenche `data`) */
async function fnError(error: unknown, data: { error?: string } | null) {
  if (data?.error) return data.error;
  try {
    const msg = String((await (error as { context?: Response })?.context?.json())?.error ?? '');
    try { return JSON.parse(msg).error ?? msg; } catch { return msg || 'Erro desconhecido'; }
  } catch { return 'Não foi possível falar com a função wa-automations.'; }
}

/** Comercial → Fluxos do WhatsApp: chatbot por gatilho (respondeu a primeira mensagem, contato novo, palavra-chave) */
export default function WaFlowsPage() {
  const [flows, setFlows] = useState<WaFlow[]>([]);
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = async () => {
    const { data, error } = await table('wa_flows').select('*').order('created_at');
    if (error) { setState('missing'); return; }
    setFlows((data ?? []) as unknown as WaFlow[]);
    const { data: r } = await table('wa_flow_runs').select('*').order('created_at', { ascending: false }).limit(500);
    setRuns((r ?? []) as unknown as FlowRun[]);
    setState('ready');
  };
  useEffect(() => {
    load();
    supabase.from('wa_numbers' as never).select('id, name, is_default').order('name')
      .then(({ data }) => setNumbers((data ?? []) as unknown as WaNumber[]));
  }, []);

  const toggle = async (f: WaFlow) => {
    if (!f.enabled) {
      const issues = flowIssues(f.steps);
      if (!f.steps.length || issues.length) { toast.error('Ajuste o fluxo antes de ligar', { description: issues[0] ?? 'O fluxo não tem passos.' }); return; }
    }
    setFlows((all) => all.map((x) => (x.id === f.id ? { ...x, enabled: !f.enabled } : x)));
    const { error } = await table('wa_flows').update({ enabled: !f.enabled, updated_at: new Date().toISOString() } as never).eq('id', f.id);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); load(); }
  };
  const duplicate = async (f: WaFlow) => {
    const { error } = await table('wa_flows').insert({ name: `${f.name} (cópia)`, enabled: false, session_id: f.session_id, trigger: f.trigger, trigger_config: f.trigger_config, steps: f.steps } as never);
    if (error) toast.error('Não foi possível duplicar', { description: error.message }); else load();
  };
  const remove = async (f: WaFlow) => {
    if (!confirm(`Apagar o fluxo "${f.name}"? Quem estiver nele para de receber as mensagens.`)) return;
    const { error } = await table('wa_flows').delete().eq('id', f.id);
    if (error) toast.error('Não foi possível apagar', { description: error.message }); else load();
  };

  if (draft) {
    return <FlowEditor draft={draft} numbers={numbers} runs={runs.filter((r) => r.flow_id === draft.id)}
      onClose={() => { setDraft(null); load(); }} onSaved={(id) => setDraft((d) => (d ? { ...d, id } : d))} />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader eyebrow="Comercial" title="Fluxos do WhatsApp"
        description="Chatbot por gatilho: quando o contato responde, o fluxo manda textos, fotos, vídeos e áudios e segue o caminho certo pela resposta."
        actions={<>
          <Button variant="outline" onClick={() => setDraft({ ...blank(), ...prospectTemplate() })}><Zap className="mr-2 h-4 w-4" />Usar modelo</Button>
          <Button onClick={() => setDraft(blank())}><Plus className="mr-2 h-4 w-4" />Novo fluxo</Button>
        </>} />

      {state === 'loading' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {state === 'missing' && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Falta aplicar a migração <code className="text-foreground">20261104120000_wa_flows</code> no Supabase para usar os fluxos.
        </div>
      )}
      {state === 'ready' && flows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Workflow className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum fluxo ainda</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Comece pelo modelo "Resposta da prospecção": quando a empresa responde, ele apresenta a INOVA, manda uma foto e pergunta se quer marcar uma conversa.</p>
          </div>
          <Button variant="outline" onClick={() => setDraft({ ...blank(), ...prospectTemplate() })}><Zap className="mr-2 h-4 w-4" />Usar modelo</Button>
        </div>
      )}
      {state === 'ready' && flows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {flows.map((f) => {
            const mine = runs.filter((r) => r.flow_id === f.id);
            const open = mine.filter((r) => ['ativo', 'aguardando', 'executando'].includes(r.status)).length;
            return (
              <div key={f.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{TRIGGERS[f.trigger]?.label ?? f.trigger}</p>
                  </div>
                  <Switch checked={f.enabled} onCheckedChange={() => toggle(f)} aria-label={f.enabled ? 'Desligar' : 'Ligar'} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{countSteps(f.steps)} passos</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{mine.length} contatos</span>
                  {open > 0 && <span>{open} em andamento</span>}
                </div>
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setDraft(f)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</Button>
                  <Button size="sm" variant="ghost" aria-label="Duplicar" onClick={() => duplicate(f)}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Apagar" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlowEditor({ draft: initial, numbers, runs, onClose, onSaved }: {
  draft: Draft; numbers: WaNumber[]; runs: FlowRun[]; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!initial.id);
  const [testOpen, setTestOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<'fluxo' | 'contatos'>('fluxo');
  const { stages } = useKanbanStages('crm');
  const ctx = useMemo(() => ({ stages: stages.map((s) => s.name) }), [stages]);
  const issues = useMemo(() => flowIssues(d.steps), [d.steps]);
  const edit = (patch: Partial<Draft>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };

  const save = async (extra: Partial<Draft> = {}) => {
    const next = { ...d, ...extra };
    if (next.enabled && (issues.length || !next.steps.length)) { toast.error('Ajuste o fluxo antes de ligar', { description: issues[0] ?? 'O fluxo não tem passos.' }); return null; }
    if (next.trigger === 'keyword' && !next.trigger_config.keywords?.trim()) { toast.error('Escolha as palavras-chave do gatilho'); return null; }
    setSaving(true);
    const row = { name: next.name.trim() || 'Fluxo sem nome', enabled: next.enabled, session_id: next.session_id, trigger: next.trigger, trigger_config: next.trigger_config, steps: next.steps, updated_at: new Date().toISOString() };
    const res = next.id
      ? await table('wa_flows').update(row as never).eq('id', next.id).select('id').single()
      : await table('wa_flows').insert(row as never).select('id').single();
    setSaving(false);
    if (res.error) { toast.error('Não foi possível salvar', { description: res.error.message }); return null; }
    const id = (res.data as unknown as { id: string }).id;
    setD({ ...next, id }); setDirty(false); onSaved(id);
    toast.success(next.enabled ? 'Fluxo salvo e ligado' : 'Fluxo salvo');
    return id;
  };

  const test = async () => {
    const id = dirty || !d.id ? await save() : d.id;
    if (!id) return;
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('wa-automations', { body: { action: 'flow_test', flow_id: id, to: testPhone } });
    setTesting(false);
    if (error || data?.error) { toast.error('Não foi possível testar', { description: await fnError(error, data) }); return; }
    setTestOpen(false);
    toast.success('Teste começou', { description: 'As mensagens chegam no seu WhatsApp. Responda para seguir os caminhos.' });
  };

  const trigger = TRIGGERS[d.trigger];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => { if (!dirty || confirm('Sair sem salvar as mudanças?')) onClose(); }}><ArrowLeft className="mr-1 h-4 w-4" />Fluxos</Button>
        <Input className="h-9 w-full max-w-xs font-medium sm:w-72" value={d.name} onChange={(e) => edit({ name: e.target.value })} aria-label="Nome do fluxo" />
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={d.enabled} onCheckedChange={(v) => edit({ enabled: v })} /> {d.enabled ? 'Ligado' : 'Desligado'}
          </label>
          <Button variant="outline" onClick={() => setTestOpen(true)}><Send className="mr-2 h-4 w-4" />Testar</Button>
          <Button onClick={() => save()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border px-4 sm:px-6">
        {(['fluxo', 'contatos'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', tab === t ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'fluxo' ? 'Fluxo' : `Contatos (${runs.length})`}
          </button>
        ))}
      </div>

      {tab === 'contatos' ? <RunsList runs={runs} /> : (
        <div className="flex-1 overflow-auto bg-muted/30 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]">
          <div className="mx-auto flex w-max min-w-full flex-col items-center px-6 py-8">
            {/* Gatilho */}
            <div className="w-[340px] rounded-xl border-2 border-foreground/80 bg-card p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><Zap className="h-3.5 w-3.5" />Gatilho</p>
              <div className="space-y-2">
                <Select value={d.trigger} onValueChange={(v) => edit({ trigger: v as FlowTrigger })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TRIGGERS) as FlowTrigger[]).map((t) => <SelectItem key={t} value={t}>{TRIGGERS[t].label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{trigger.hint}</p>
                {d.trigger === 'keyword' && (
                  <div className="flex gap-2">
                    <Input className="h-9 flex-1" placeholder="preço, orçamento, valores" value={d.trigger_config.keywords ?? ''}
                      onChange={(e) => edit({ trigger_config: { ...d.trigger_config, keywords: e.target.value } })} />
                    <Select value={d.trigger_config.match ?? 'contains'} onValueChange={(v) => edit({ trigger_config: { ...d.trigger_config, match: v as 'contains' | 'exact' } })}>
                      <SelectTrigger className="h-9 w-[118px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="contains">contém</SelectItem><SelectItem value="exact">só a palavra</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
                <Select value={d.session_id ?? 'all'} onValueChange={(v) => edit({ session_id: v === 'all' ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Em qualquer número</SelectItem>
                    {numbers.map((n) => <SelectItem key={n.id} value={n.id}>Só no número {n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>Só uma vez por contato</span>
                  <Switch checked={d.trigger_config.once !== false} onCheckedChange={(v) => edit({ trigger_config: { ...d.trigger_config, once: v } })} />
                </label>
              </div>
            </div>
            <StepList steps={d.steps} onChange={(steps) => edit({ steps })} ctx={ctx} />
            {issues.length > 0 && (
              <div className="mt-6 w-[340px] rounded-lg border border-border bg-card p-3 text-xs">
                <p className="mb-1 font-medium">Falta ajustar antes de ligar</p>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{issues.slice(0, 6).map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Testar o fluxo</DialogTitle>
          <DialogDescription>O fluxo começa agora no telefone abaixo, mesmo desligado. Responda pelo WhatsApp para ver os caminhos funcionando.</DialogDescription>
          <Input placeholder="Seu WhatsApp (ex.: 11999990000)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTestOpen(false)}>Cancelar</Button>
            <Button onClick={test} disabled={testing || testPhone.replace(/\D/g, '').length < 10}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Começar teste</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunsList({ runs }: { runs: FlowRun[] }) {
  if (!runs.length) return <p className="p-6 text-sm text-muted-foreground">Ninguém passou por este fluxo ainda.</p>;
  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {runs.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.contact_name || `+${r.phone}`}</p>
              <p className="text-xs text-muted-foreground">+{r.phone} · entrou {fmt(r.created_at)}</p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', r.status === 'erro' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
              {RUN_STATUS[r.status] ?? r.status}
              {['ativo', 'aguardando'].includes(r.status) && ` até ${fmt(r.next_at)}`}
            </span>
            {r.status === 'erro' && r.last_error && <p className="w-full text-xs text-destructive">{r.last_error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
