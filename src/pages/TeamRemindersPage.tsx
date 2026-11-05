import { useEffect, useMemo, useState } from 'react';
import { BellRing, ClipboardList, Copy, ListChecks, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  COORDINATOR_ROUTINE, WEEK_ORDER, WEEKDAY_SHORT, emptyReminder, phoneOf, reminderMessage, type ReminderLog, type TeamReminder,
} from '@/lib/teamReminders';

// Tabelas novas, ainda fora dos tipos gerados do Supabase
const table = (t: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(t);
type Draft = Omit<TeamReminder, 'id' | 'last_run_on'> & { id?: string };

const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Equipe → Lembretes: checklists e lembretes por dia da semana que saem sozinhos no WhatsApp de cada funcionário */
export default function TeamRemindersPage() {
  const { team } = useAgency();
  const [list, setList] = useState<TeamReminder[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<TeamReminder | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  // Modelo "Rotina do coordenador": para quem e quais blocos criar
  const [routine, setRoutine] = useState<{ person: string; picked: number[] } | null>(null);

  const load = async () => {
    const { data, error } = await table('team_reminders').select('*').order('send_time');
    if (error) { setState('missing'); return; }
    // Sem a migração dos vários horários: usa o horário único
    setList(((data ?? []) as unknown as TeamReminder[]).map((r) => ({ ...r, send_times: r.send_times?.length ? r.send_times.map((t) => t.slice(0, 5)) : [r.send_time.slice(0, 5)] })));
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: l } = await table('team_reminder_logs').select('reminder_id, person, sent_on, status, error').gte('sent_on', since).order('created_at', { ascending: false });
    setLogs((l ?? []) as unknown as ReminderLog[]);
    setState('ready');
  };
  useEffect(() => {
    load();
    supabase.from('profiles').select('id, whatsapp' as never).then(({ data }) =>
      setPhones(Object.fromEntries(((data ?? []) as unknown as { id: string; whatsapp: string | null }[]).map((p) => [p.id, phoneOf(p.whatsapp)]))));
  }, []);

  const nameOf = useMemo(() => Object.fromEntries(team.map((m) => [m.id, m.name])), [team]);
  const byDay = useMemo(() => Object.fromEntries(WEEK_ORDER.map((d) => [d,
    list.filter((r) => r.weekdays.includes(d)).sort((a, b) => a.send_times[0].localeCompare(b.send_times[0]))])), [list]);
  const today = todayIso();
  const todayDow = new Date().getDay();

  const save = async () => {
    if (!draft) return;
    const items = draft.items.map((i) => i.trim()).filter(Boolean);
    if (!draft.title.trim()) { toast.error('Dê um título'); return; }
    if (draft.kind === 'checklist' && !items.length) { toast.error('Coloque pelo menos um item no checklist'); return; }
    if (draft.kind === 'lembrete' && !draft.message.trim() && !items.length) { toast.error('Escreva o lembrete'); return; }
    if (!draft.weekdays.length) { toast.error('Escolha pelo menos um dia da semana'); return; }
    if (!draft.people.length) { toast.error('Escolha quem recebe'); return; }
    const times = [...new Set(draft.send_times.filter(Boolean))].sort();
    if (!times.length) { toast.error('Escolha pelo menos um horário'); return; }
    setSaving(true);
    const { id, ...row } = { ...draft, title: draft.title.trim(), items, send_times: times, send_time: times[0], updated_at: new Date().toISOString() };
    const { error } = id ? await table('team_reminders').update(row as never).eq('id', id) : await table('team_reminders').insert(row as never);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível salvar', { description: /send_times/.test(error.message) ? 'Falta aplicar a migração 20261103130000_team_reminders_times.' : error.message });
      return;
    }
    toast.success(id ? 'Lembrete atualizado' : 'Lembrete criado');
    setDraft(null); load();
  };

  const createRoutine = async () => {
    if (!routine?.person) { toast.error('Escolha quem vai receber a rotina'); return; }
    const rows = routine.picked.map((i) => COORDINATOR_ROUTINE[i]).map((r) => ({
      ...r, send_time: r.send_times[0], people: [routine.person], enabled: true, updated_at: new Date().toISOString(),
    }));
    if (!rows.length) { toast.error('Escolha pelo menos um bloco'); return; }
    setSaving(true);
    const { error } = await table('team_reminders').insert(rows as never);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível criar a rotina', { description: /send_times/.test(error.message) ? 'Falta aplicar a migração 20261103130000_team_reminders_times.' : error.message });
      return;
    }
    toast.success(`Rotina criada: ${rows.length} lembretes para ${nameOf[routine.person] ?? 'a pessoa'}`, { description: 'Cada um pode ser editado ou desligado aqui.' });
    setRoutine(null); load();
  };

  const toggle = async (r: TeamReminder) => {
    const { error } = await table('team_reminders').update({ enabled: !r.enabled } as never).eq('id', r.id);
    if (error) { toast.error('Não foi possível alterar'); return; }
    setList((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: !r.enabled } : x)));
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await table('team_reminders').delete().eq('id', removing.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    toast.success('Lembrete excluído');
    setRemoving(null); load();
  };

  /** Manda agora para todos os escolhidos (não conta como o envio do dia) */
  const sendNow = async (r: TeamReminder) => {
    setTesting(r.id);
    let ok = 0; const fail: string[] = [];
    for (const pid of r.people) {
      const to = phones[pid]; const person = nameOf[pid] ?? '';
      if (!to) { fail.push(`${person || 'alguém'} (sem WhatsApp)`); continue; }
      const { data, error } = await supabase.functions.invoke('wa-server', { body: { action: 'send', to, message: reminderMessage(r, person, todayDow) } });
      if (error || data?.error) fail.push(person); else ok++;
      await table('team_reminder_logs').insert({ reminder_id: r.id, profile_id: pid, person, sent_on: today, status: error || data?.error ? 'erro' : 'teste', error: data?.error ?? '' } as never);
    }
    setTesting(null);
    if (ok) toast.success(ok === 1 ? 'Enviado para 1 pessoa' : `Enviado para ${ok} pessoas`, fail.length ? { description: `Não foi: ${fail.join(', ')}` } : undefined);
    else toast.error('Nada enviado', { description: fail.join(', ') || 'Confira o WhatsApp conectado em Automações.' });
    load();
  };

  const statusToday = (r: TeamReminder) => {
    const l = logs.filter((x) => x.reminder_id === r.id && x.sent_on === today && x.status !== 'teste');
    if (!l.length) return null;
    const sent = l.filter((x) => x.status === 'enviado').length;
    const bad = l.filter((x) => x.status !== 'enviado');
    return { sent, bad };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lembretes da equipe"
        description="Checklists e lembretes por dia da semana. Saem sozinhos no WhatsApp de cada funcionário no horário marcado."
        actions={<>
          <Button variant="outline" onClick={() => setRoutine({ person: '', picked: COORDINATOR_ROUTINE.map((_, i) => i) })} disabled={state !== 'ready'}>
            <ListChecks className="mr-2 h-4 w-4" />Rotina do coordenador
          </Button>
          <Button onClick={() => setDraft(emptyReminder())} disabled={state !== 'ready'}><Plus className="mr-2 h-4 w-4" />Novo lembrete</Button>
        </>}
      />

      {state === 'loading' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {state === 'missing' && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          Falta aplicar a migração <code className="text-xs">20261103120000_team_reminders</code> no Lovable.
        </p>
      )}

      {state === 'ready' && list.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">Nenhum lembrete ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Ex.: checklist de abertura toda segunda às 8h para os social medias.</p>
        </div>
      )}

      {state === 'ready' && list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEEK_ORDER.map((d) => (
            <section key={d} className={cn('rounded-xl border bg-card', d === todayDow && 'border-primary/60')}>
              <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
                {WEEKDAY_SHORT[d]}{d === todayDow && <span className="text-[11px] font-medium text-primary">hoje</span>}
              </h2>
              <ul className="space-y-2 p-2">
                {byDay[d].map((r) => {
                  const st = d === todayDow ? statusToday(r) : null;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setDraft({ ...r })}
                        className={cn('w-full rounded-lg border p-2 text-left transition-colors hover:border-foreground/30', !r.enabled && 'opacity-50')}>
                        <p className="text-xs font-semibold tabular-nums text-muted-foreground">{r.send_times.join(' · ')}</p>
                        <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                          {r.kind === 'checklist' ? <ClipboardList className="h-3.5 w-3.5 shrink-0" /> : <BellRing className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{r.title}</span>
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.people.map((p) => (nameOf[p] ?? '?').split(' ')[0]).join(', ')}</p>
                        {st && (
                          <p className={cn('mt-1 text-[11px] font-medium', st.bad.length ? 'text-warning' : 'text-success')}>
                            {st.sent} enviado{st.sent === 1 ? '' : 's'}{st.bad.length ? ` · ${st.bad.length} sem envio` : ''}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
                {byDay[d].length === 0 && <li className="px-1 py-2 text-xs text-muted-foreground">—</li>}
              </ul>
            </section>
          ))}
        </div>
      )}

      {state === 'ready' && list.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Todos os lembretes</h2>
          <ul className="divide-y">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Switch checked={r.enabled} onCheckedChange={() => toggle(r)} aria-label={r.enabled ? 'Desligar' : 'Ligar'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {WEEK_ORDER.filter((d) => r.weekdays.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ')} · {r.send_times.join(', ')} · {r.people.map((p) => nameOf[p] ?? '?').join(', ')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => sendNow(r)} disabled={testing === r.id} title="Mandar agora para os escolhidos">
                    {testing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}<span className="ml-1.5 hidden sm:inline">Enviar agora</span>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setDraft({ ...r })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Duplicar"
                    onClick={() => { const { id: _id, last_run_on: _l, ...rest } = r; setDraft({ ...rest, title: `${r.title} (cópia)` }); }}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={!!draft} onOpenChange={(v) => { if (!v) setDraft(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? 'Editar lembrete' : 'Novo lembrete'}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-5 md:grid-cols-[1fr_240px]">
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['checklist', 'lembrete'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setDraft({ ...draft, kind: k })}
                      className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm font-medium transition-colors',
                        draft.kind === k ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:border-foreground/30')}>
                      {k === 'checklist' ? <ClipboardList className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}{k === 'checklist' ? 'Checklist' : 'Lembrete'}
                    </button>
                  ))}
                </div>
                <div><Label>Título</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Abertura do dia" /></div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} rows={3}
                    placeholder={draft.kind === 'checklist' ? 'Bom dia, {nome}! Checklist de {dia}:' : 'Ex.: {nome}, não esquece de mandar o relatório hoje!'} />
                  <p className="mt-1 text-xs text-muted-foreground">{'{nome}'} vira o primeiro nome da pessoa e {'{dia}'} o dia da semana.</p>
                </div>
                <div className="space-y-2">
                  <Label>{draft.kind === 'checklist' ? 'Itens do checklist' : 'Itens (opcional)'}</Label>
                  {draft.items.map((it, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={it} placeholder={`Item ${i + 1}`}
                        onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, j) => (j === i ? e.target.value : x)) })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDraft({ ...draft, items: [...draft.items.slice(0, i + 1), '', ...draft.items.slice(i + 1)] }); } }} />
                      <Button size="icon" variant="ghost" aria-label="Tirar item" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, items: [...draft.items, ''] })}><Plus className="mr-1.5 h-3.5 w-3.5" />Item</Button>
                </div>
                <div>
                  <Label>Dias da semana</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {WEEK_ORDER.map((d) => (
                      <button key={d} type="button" onClick={() => setDraft({ ...draft, weekdays: draft.weekdays.includes(d) ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d] })}
                        className={cn('h-9 w-12 rounded-md border text-sm font-medium transition-colors',
                          draft.weekdays.includes(d) ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:border-foreground/30')}>
                        {WEEKDAY_SHORT[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <Label>Horários no dia</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {draft.send_times.map((t, i) => (
                        <div key={i} className="flex items-center">
                          <Input type="time" value={t} aria-label={`Horário ${i + 1}`} className="w-28"
                            onChange={(e) => setDraft({ ...draft, send_times: draft.send_times.map((x, j) => (j === i ? e.target.value : x)) })} />
                          {draft.send_times.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Tirar horário"
                              onClick={() => setDraft({ ...draft, send_times: draft.send_times.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                          )}
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, send_times: [...draft.send_times, ''] })}><Plus className="mr-1.5 h-3.5 w-3.5" />Horário</Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} /> Ligado</label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Quem recebe</Label>
                  <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border py-1">
                    {team.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                          <Checkbox checked={draft.people.includes(m.id)}
                            onCheckedChange={() => setDraft({ ...draft, people: draft.people.includes(m.id) ? draft.people.filter((x) => x !== m.id) : [...draft.people, m.id] })} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                          {!phones[m.id] && <span className="text-[10px] text-warning" title="Preencha em Equipe → Funcionários">sem WhatsApp</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label>Como chega</Label>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs text-foreground">
                    {reminderMessage({ ...draft, title: draft.title || 'Título' }, nameOf[draft.people[0]] ?? 'Ana', draft.weekdays.includes(todayDow) ? todayDow : (draft.weekdays[0] ?? 1))}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!routine} onOpenChange={(v) => { if (!v) setRoutine(null); }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Rotina do coordenador</DialogTitle></DialogHeader>
          {routine && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Cria um lembrete por bloco do dia e da semana. Cada um chega no WhatsApp da pessoa no horário, com o checklist do bloco.</p>
              <div>
                <Label>Quem recebe</Label>
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border py-1">
                  {team.map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                        <input type="radio" name="routine-person" className="accent-primary" checked={routine.person === m.id} onChange={() => setRoutine({ ...routine, person: m.id })} />
                        <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                        {!phones[m.id] && <span className="text-[10px] text-warning" title="Preencha em Equipe → Funcionários">sem WhatsApp</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label>Blocos</Label>
                <ul className="mt-1 divide-y rounded-lg border">
                  {COORDINATOR_ROUTINE.map((r, i) => (
                    <li key={r.title}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                        <Checkbox checked={routine.picked.includes(i)}
                          onCheckedChange={() => setRoutine({ ...routine, picked: routine.picked.includes(i) ? routine.picked.filter((x) => x !== i) : [...routine.picked, i] })} />
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{r.send_times[0]}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{r.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {r.weekdays.length === 5 ? 'Seg a sex' : r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ')}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoutine(null)}>Cancelar</Button>
            <Button onClick={createRoutine} disabled={saving || !routine?.person || !routine.picked.length}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar {routine?.picked.length ?? 0} lembretes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => { if (!v) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{removing?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>Ele para de ser enviado. Para só pausar, desligue a chave.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
