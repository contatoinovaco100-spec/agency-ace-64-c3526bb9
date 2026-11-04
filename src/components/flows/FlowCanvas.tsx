import { Fragment, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  FLOW_VARS, STEP_GROUPS, STEP_TYPES, durationLabel, newId, newStep,
  type Branch, type FlowStep, type StepType, type TimeUnit,
} from '@/lib/waFlows';

type Ctx = { stages: string[] };
const MEDIA: Record<string, { accept: string; maxMb: number }> = {
  image: { accept: 'image/*', maxMb: 5 },
  video: { accept: 'video/mp4,video/*', maxMb: 16 },
  audio: { accept: 'audio/*,.ogg,.opus,.mp3,.m4a', maxMb: 16 },
  document: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf', maxMb: 50 },
};

const Line = ({ className }: { className?: string }) => <div className={cn('h-5 w-px bg-border', className)} />;

/** Botão "+" entre os passos: escolhe o tipo do passo novo */
function AddStep({ onPick, allowWait }: { onPick: (t: StepType) => void; allowWait: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <Line />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Adicionar passo"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          {STEP_GROUPS.map((g, gi) => (
            <Fragment key={g}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{g}</DropdownMenuLabel>
              {(Object.keys(STEP_TYPES) as StepType[]).filter((t) => STEP_TYPES[t].group === g).map((t) => {
                const { label, icon: Icon } = STEP_TYPES[t];
                const blocked = t === 'wait_reply' && !allowWait;
                return (
                  <DropdownMenuItem key={t} disabled={blocked} onSelect={() => onPick(t)}>
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="flex-1">{label}</span>
                    {blocked && <span className="text-[10px] text-muted-foreground">só no fim</span>}
                  </DropdownMenuItem>
                );
              })}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Line />
    </div>
  );
}

/** Lista de passos (o fluxo principal ou um caminho de resposta). "Esperar resposta" só pode ser o último. */
export function StepList({ steps, onChange, ctx, emptyHint }: { steps: FlowStep[]; onChange: (s: FlowStep[]) => void; ctx: Ctx; emptyHint?: string }) {
  const endsWithWait = steps.at(-1)?.type === 'wait_reply';
  const insert = (i: number, t: StepType) => { const next = [...steps]; next.splice(i, 0, newStep(t)); onChange(next); };
  const update = (i: number, s: FlowStep) => onChange(steps.map((x, j) => (j === i ? s : x)));
  const remove = (i: number) => onChange(steps.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => { const next = [...steps]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };

  return (
    <div className="flex flex-col items-center">
      {steps.length === 0 && emptyHint && (
        <>
          <Line />
          <p className="max-w-[220px] rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">{emptyHint}</p>
        </>
      )}
      {steps.map((s, i) => (
        <Fragment key={s.id}>
          {/* Inserir antes do primeiro passo; depois, cada "+" fica abaixo do passo */}
          {i === 0 && <AddStep onPick={(t) => insert(0, t)} allowWait={false} />}
          <StepCard step={s} ctx={ctx} onChange={(n) => update(i, n)} onRemove={() => remove(i)}
            onUp={i > 0 ? () => move(i, -1) : undefined}
            onDown={i < steps.length - 1 && steps[i + 1].type !== 'wait_reply' && s.type !== 'wait_reply' ? () => move(i, 1) : undefined} />
          {s.type !== 'wait_reply' && i < steps.length - 1 && <AddStep onPick={(t) => insert(i + 1, t)} allowWait={false} />}
        </Fragment>
      ))}
      {!endsWithWait && <AddStep onPick={(t) => insert(steps.length, t)} allowWait />}
      {!endsWithWait && steps.length > 0 && (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Fim</span>
      )}
    </div>
  );
}

function StepCard({ step, onChange, onRemove, onUp, onDown, ctx }: {
  step: FlowStep; onChange: (s: FlowStep) => void; onRemove: () => void; onUp?: () => void; onDown?: () => void; ctx: Ctx;
}) {
  const { label, icon: Icon } = STEP_TYPES[step.type];
  const set = (patch: Partial<FlowStep>) => onChange({ ...step, ...patch });
  return (
    <div className="flex flex-col items-center">
      <div className="w-[300px] rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground"><Icon className="h-3.5 w-3.5" /></span>
          <span className="flex-1 truncate text-sm font-medium">{label}</span>
          {onUp && <IconBtn label="Subir" onClick={onUp}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>}
          {onDown && <IconBtn label="Descer" onClick={onDown}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>}
          <IconBtn label="Remover passo" onClick={onRemove} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
        </div>
        <div className="space-y-2 p-3"><StepFields step={step} set={set} ctx={ctx} /></div>
      </div>
      {step.type === 'wait_reply' && <Branches step={step} set={set} ctx={ctx} />}
    </div>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn('rounded p-1 text-muted-foreground transition-colors hover:bg-muted', danger ? 'hover:text-destructive' : 'hover:text-foreground')}>
      {children}
    </button>
  );
}

function Duration({ step, set, units = ['segundos', 'minutos', 'horas', 'dias'] }: { step: FlowStep; set: (p: Partial<FlowStep>) => void; units?: TimeUnit[] }) {
  return (
    <div className="flex gap-2">
      <Input type="number" min={0} className="h-9 w-20" value={step.amount ?? 0} onChange={(e) => set({ amount: Math.max(0, Number(e.target.value)) })} />
      <Select value={step.unit ?? 'minutos'} onValueChange={(v) => set({ unit: v as TimeUnit })}>
        <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function StepFields({ step, set, ctx }: { step: FlowStep; set: (p: Partial<FlowStep>) => void; ctx: Ctx }) {
  switch (step.type) {
    case 'text':
      return (
        <>
          <Textarea rows={4} placeholder="Escreva a mensagem…" value={step.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">Use {FLOW_VARS.join(' ')} · *negrito* · _itálico_</p>
        </>
      );
    case 'image': case 'video': case 'audio': case 'document':
      return (
        <>
          <MediaPicker step={step} set={set} />
          {step.type !== 'audio' && (
            <Input placeholder={step.type === 'document' ? 'Texto junto do arquivo (opcional)' : 'Legenda (opcional)'} value={step.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} />
          )}
          {step.type === 'audio' && <p className="text-[11px] text-muted-foreground">Arquivo .ogg/.opus chega como mensagem de voz; mp3 e m4a chegam como arquivo de áudio.</p>}
        </>
      );
    case 'delay':
      return (
        <>
          <Duration step={step} set={set} />
          <p className="text-[11px] text-muted-foreground">Até 45 segundos sai na hora; esperas maiores são conferidas a cada rodada (15 min).</p>
        </>
      );
    case 'wait_reply':
      return (
        <>
          <p className="text-xs text-muted-foreground">Espera o contato responder por até</p>
          <Duration step={step} set={set} units={['minutos', 'horas', 'dias']} />
          <p className="text-[11px] text-muted-foreground">O caminho é escolhido pela palavra que aparece primeiro na resposta.</p>
        </>
      );
    case 'move_stage':
      return (
        <Select value={step.stage || undefined} onValueChange={(v) => set({ stage: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Escolha a etapa do CRM" /></SelectTrigger>
          <SelectContent>{ctx.stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      );
    case 'notify':
      return (
        <>
          <Input placeholder="WhatsApp de quem recebe (ex.: 11999990000)" value={step.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          <Textarea rows={2} value={step.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">O nome e o telefone do contato vão junto.</p>
        </>
      );
    case 'stop_followup':
      return <p className="text-xs text-muted-foreground">Para as sequências de follow-up do CRM em que este lead estiver.</p>;
    default:
      return <p className="text-xs text-muted-foreground">O fluxo termina aqui para este contato.</p>;
  }
}

/** Envio de foto, vídeo, áudio ou arquivo para o bucket público task-attachments (pasta fluxos/) */
function MediaPicker({ step, set }: { step: FlowStep; set: (p: Partial<FlowStep>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const cfg = MEDIA[step.type];
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > cfg.maxMb * 1024 * 1024) { toast.error('Arquivo muito grande', { description: `O WhatsApp aceita até ${cfg.maxMb} MB neste tipo.` }); return; }
    setBusy(true);
    const path = `fluxos/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file, { contentType: file.type || undefined });
    setBusy(false);
    if (error) { toast.error('Não foi possível enviar o arquivo', { description: error.message }); return; }
    const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
    set({ url: data.publicUrl, ...(step.type === 'document' ? { fileName: file.name } : {}) });
  };
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept={cfg.accept} className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      {step.url && step.type === 'image' && <img src={step.url} alt="" className="max-h-40 w-full rounded-lg border border-border object-cover" />}
      {step.url && step.type === 'video' && <video src={step.url} controls className="max-h-40 w-full rounded-lg border border-border" />}
      {step.url && step.type === 'audio' && <audio src={step.url} controls className="w-full" />}
      {step.url && step.type === 'document' && <p className="truncate rounded-lg border border-border px-2 py-1.5 text-xs">{step.fileName || step.url.split('/').pop()}</p>}
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? 'Enviando…' : step.url ? 'Trocar arquivo' : 'Escolher arquivo'}
      </Button>
    </div>
  );
}

/** Caminhos do "esperar resposta", lado a lado: um por palavra-chave, "outra resposta" e "não respondeu" */
function Branches({ step, set, ctx }: { step: FlowStep; set: (p: Partial<FlowStep>) => void; ctx: Ctx }) {
  const branches = step.branches ?? [];
  const setBranch = (id: string, patch: Partial<Branch>) => set({ branches: branches.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const columns: { key: string; head: React.ReactNode; steps: FlowStep[]; onSteps: (s: FlowStep[]) => void }[] = [
    ...branches.map((b) => ({
      key: b.id,
      head: (
        <div className="w-[300px] space-y-1.5 rounded-lg border border-border bg-muted/40 p-2">
          <div className="flex items-center gap-1">
            <Input className="h-8 font-medium" placeholder="Nome do caminho" value={b.label} onChange={(e) => setBranch(b.id, { label: e.target.value })} />
            <IconBtn label="Remover caminho" danger onClick={() => set({ branches: branches.filter((x) => x.id !== b.id) })}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
          </div>
          <Input className="h-8 text-xs" placeholder="Palavras, separadas por vírgula" value={b.keywords} onChange={(e) => setBranch(b.id, { keywords: e.target.value })} />
        </div>
      ),
      steps: b.steps, onSteps: (s: FlowStep[]) => setBranch(b.id, { steps: s }),
    })),
    {
      key: 'other',
      head: <PathHead title="Qualquer outra resposta" sub="Não bateu com nenhuma palavra" />,
      steps: step.other ?? [], onSteps: (s) => set({ other: s }),
    },
    {
      key: 'timeout',
      head: <PathHead title="Não respondeu" sub={`Depois de ${durationLabel(step)}`} />,
      steps: step.timeout ?? [], onSteps: (s) => set({ timeout: s }),
    },
  ];

  return (
    <div className="flex flex-col items-center">
      <Line />
      <div className="flex items-start">
        {columns.map((c, i) => (
          <div key={c.key} className="relative flex flex-col items-center px-3">
            {/* Linha horizontal que liga os caminhos */}
            {columns.length > 1 && (
              <span className={cn('absolute top-0 h-px bg-border', i === 0 ? 'left-1/2 right-0' : i === columns.length - 1 ? 'left-0 right-1/2' : 'inset-x-0')} />
            )}
            <Line />
            {c.head}
            <StepList steps={c.steps} onChange={c.onSteps} ctx={ctx} emptyHint="Sem passos: o fluxo encerra aqui" />
          </div>
        ))}
        <div className="px-3 pt-5">
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap"
            onClick={() => set({ branches: [...branches, { id: newId(), label: `Caminho ${branches.length + 1}`, keywords: '', steps: [] }] })}>
            <Plus className="mr-1 h-4 w-4" /> Caminho
          </Button>
        </div>
      </div>
    </div>
  );
}

function PathHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="w-[300px] rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
