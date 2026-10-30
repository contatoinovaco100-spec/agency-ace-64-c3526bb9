import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Step = { day: number; message: string };
type Sequence = {
  id: string; name: string; steps: Step[]; stop_on_reply: boolean; start_hour: number; end_hour: number;
  weekdays_only: boolean; auto_enroll_new: boolean; active: boolean;
};
type Enrollment = { id: string; lead_id: string; sequence_id: string; step_index: number; next_at: string; status: string; last_error: string; leads?: { name: string; company: string } };

const SEQS = 'crm_sequences' as never;
const ENR = 'crm_enrollments' as never;
const VARS = [['nome', 'Primeiro nome do lead'], ['empresa', 'Empresa'], ['vendedor', 'Primeiro nome do vendedor']] as const;

const empty = (): Partial<Sequence> => ({
  name: '', steps: [{ day: 0, message: '' }, { day: 2, message: '' }], stop_on_reply: true,
  start_hour: 9, end_hour: 19, weekdays_only: true, auto_enroll_new: false, active: true,
});

/** Sequências de follow-up (mensagens em dias definidos, que param quando o lead responde) */
export function CrmFollowUp() {
  const [seqs, setSeqs] = useState<Sequence[] | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [editing, setEditing] = useState<Partial<Sequence> | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error }, { data: e }] = await Promise.all([
      supabase.from(SEQS).select('*').order('created_at'),
      supabase.from(ENR).select('id, lead_id, sequence_id, step_index, next_at, status, last_error, leads(name, company)').order('updated_at', { ascending: false }).limit(200),
    ]);
    setMissing(!!error);
    setSeqs((data ?? []) as unknown as Sequence[]);
    setEnrollments((e ?? []) as unknown as Enrollment[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const m: Record<string, { ativo: number; respondeu: number; total: number }> = {};
    enrollments.forEach((e) => {
      const s = (m[e.sequence_id] ??= { ativo: 0, respondeu: 0, total: 0 });
      s.total++; if (e.status === 'ativo') s.ativo++; if (e.status === 'respondeu') s.respondeu++;
    });
    return m;
  }, [enrollments]);

  const toggle = async (s: Sequence, active: boolean) => {
    setSeqs((l) => l?.map((x) => (x.id === s.id ? { ...x, active } : x)) ?? null);
    await supabase.from(SEQS).update({ active } as never).eq('id', s.id);
  };
  const remove = async (s: Sequence) => {
    if (!confirm(`Excluir "${s.name}"? Os leads em andamento param.`)) return;
    await supabase.from(SEQS).delete().eq('id', s.id); load();
  };

  if (missing) return <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">O follow-up ainda não está no banco. Peça ao Lovable para aplicar a migração <code>20261030210000_crm_whatsapp.sql</code>.</p>;
  if (!seqs) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const seqName = Object.fromEntries(seqs.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Mensagens automáticas em dias definidos. Param sozinhas quando o lead responde ou vira cliente/perdido.</p>
        <Button className="shrink-0 gap-1.5" onClick={() => setEditing(empty())}><Plus className="h-4 w-4" /> Nova sequência</Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {seqs.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma sequência ainda.</li>}
        {seqs.map((s) => {
          const st = stats[s.id];
          return (
            <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.steps.length} mensagens · dias {s.steps.map((x) => x.day).join(', ')} · {s.start_hour}h às {s.end_hour}h{s.weekdays_only ? ', dias úteis' : ''}
                  {s.auto_enroll_new ? ' · entra todo lead novo' : ''}
                  {st ? ` · ${st.ativo} em andamento, ${st.respondeu} responderam (${Math.round((st.respondeu / st.total) * 100)}%)` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                <Switch checked={s.active} onCheckedChange={(v) => toggle(s, v)} className="ml-2" aria-label="Ativa" />
              </div>
            </li>
          );
        })}
      </ul>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Leads em follow-up</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {enrollments.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum lead em follow-up. Inicie pelo card do lead ou pela conversa.</li>}
          {enrollments.slice(0, 60).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{e.leads?.company || e.leads?.name || 'Lead'}</span><span className="text-muted-foreground"> · {seqName[e.sequence_id] ?? ''}</span></span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {e.status === 'ativo' ? `próxima ${new Date(e.next_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : `${e.step_index} enviadas`}
              </span>
              <span className={cn('text-xs font-medium', e.status === 'respondeu' ? 'text-success' : e.status === 'erro' ? 'text-destructive' : e.status === 'ativo' ? 'text-primary' : 'text-muted-foreground')} title={e.last_error || undefined}>
                {{ ativo: 'Em andamento', respondeu: 'Respondeu', concluido: 'Concluído', parado: 'Parado', erro: 'Erro' }[e.status] ?? e.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {editing && <SequenceEditor seq={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function SequenceEditor({ seq, onClose, onSaved }: { seq: Partial<Sequence>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Partial<Sequence>>(seq);
  const set = (p: Partial<Sequence>) => setD((x) => ({ ...x, ...p }));
  const steps = d.steps ?? [];
  const setStep = (i: number, p: Partial<Step>) => set({ steps: steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const valid = !!d.name?.trim() && steps.length > 0 && steps.every((s) => s.message.trim());

  const save = async () => {
    const row = { ...d, steps: [...steps].sort((a, b) => a.day - b.day), updated_at: new Date().toISOString() } as Record<string, unknown>;
    delete row.id;
    const { error } = d.id
      ? await supabase.from(SEQS).update(row as never).eq('id', d.id)
      : await supabase.from(SEQS).insert(row as never);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    toast.success('Sequência salva'); onSaved();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b p-5">
          <SheetTitle>{d.id ? 'Editar sequência' : 'Nova sequência'}</SheetTitle>
          <SheetDescription>Cada mensagem sai no dia indicado, contado a partir de quando o lead entra na sequência.</SheetDescription>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Follow-up de proposta" /></div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Mensagem {i + 1}</span>
                  <span className="ml-auto text-xs text-muted-foreground">no dia</span>
                  <Input type="number" min={0} max={90} className="h-8 w-16" value={s.day} onChange={(e) => setStep(i, { day: Math.max(0, Number(e.target.value) || 0) })} />
                  {steps.length > 1 && <button onClick={() => set({ steps: steps.filter((_, j) => j !== i) })} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <Textarea value={s.message} onChange={(e) => setStep(i, { message: e.target.value })} className="min-h-[90px] text-sm" placeholder="Oi, {nome}! …" />
                <div className="flex gap-1.5">
                  {VARS.map(([k, l]) => (
                    <button key={k} type="button" title={l} onClick={() => setStep(i, { message: `${s.message}{${k}}` })}
                      className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground">{`{${k}}`}</button>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => set({ steps: [...steps, { day: (steps.at(-1)?.day ?? 0) + 3, message: '' }] })}>
              <Plus className="h-3.5 w-3.5" /> Adicionar mensagem
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Enviar a partir das</Label>
              <Input type="number" min={0} max={23} value={d.start_hour ?? 9} onChange={(e) => set({ start_hour: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Até as</Label>
              <Input type="number" min={1} max={24} value={d.end_hour ?? 19} onChange={(e) => set({ end_hour: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!d.weekdays_only} onCheckedChange={(v) => set({ weekdays_only: v })} /> Só em dias úteis</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={d.stop_on_reply !== false} onCheckedChange={(v) => set({ stop_on_reply: v })} /> Parar quando o lead responder</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!d.auto_enroll_new} onCheckedChange={(v) => set({ auto_enroll_new: v })} /> Colocar todo lead novo (capturado) nesta sequência</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!valid}>Salvar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
