import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Square, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Sequence = { id: string; name: string; steps: { day: number; message: string }[]; active: boolean };
type Enrollment = { id: string; sequence_id: string; step_index: number; next_at: string; status: string; last_error: string };

const SEQS = 'crm_sequences' as never;
const ENR = 'crm_enrollments' as never;

const STATUS: Record<string, { label: string; tone: string }> = {
  ativo: { label: 'Em andamento', tone: 'text-primary' },
  respondeu: { label: 'Respondeu ✓', tone: 'text-success' },
  concluido: { label: 'Concluído', tone: 'text-muted-foreground' },
  parado: { label: 'Parado', tone: 'text-muted-foreground' },
  erro: { label: 'Erro', tone: 'text-destructive' },
};

/** Botão "Follow-up": inscreve o lead numa sequência ativa */
export function EnrollButton({ leadId, session, small, onDone }: { leadId: string; session?: string | null; small?: boolean; onDone?: () => void }) {
  const [seqs, setSeqs] = useState<Sequence[]>([]);
  useEffect(() => {
    supabase.from(SEQS).select('id, name, steps, active').eq('active', true).order('name')
      .then(({ data }) => setSeqs((data ?? []) as unknown as Sequence[]));
  }, []);

  const enroll = async (s: Sequence) => {
    const { data: u } = await supabase.auth.getUser();
    const first = Number(s.steps?.[0]?.day ?? 0);
    const { error } = await supabase.from(ENR).insert({
      lead_id: leadId, sequence_id: s.id, step_index: 0, session_id: session ?? null, created_by: u.user?.id ?? null,
      next_at: new Date(Date.now() + first * 86_400_000).toISOString(),
    } as never);
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? 'Este lead já está nessa sequência' : 'Não foi possível iniciar', { description: error.message }); return; }
    toast.success(`Follow-up "${s.name}" iniciado`, { description: first === 0 ? 'A primeira mensagem sai no próximo horário permitido.' : `A primeira mensagem sai em ${first} dia(s).` });
    onDone?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={small ? 'sm' : 'default'} variant="outline" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Follow-up</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Iniciar sequência</DropdownMenuLabel>
        {seqs.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma sequência ativa. Crie na aba Follow-up.</p>}
        {seqs.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => enroll(s)} className="flex-col items-start gap-0">
            <span className="text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">{s.steps.length} mensagens · dias {s.steps.map((x) => x.day).join(', ')}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Bloco do lead no CRM: próximo passo, follow-ups e atalho para a conversa */
export function LeadExtras({ leadId, onOpenConversation }: { leadId: string; onOpenConversation?: () => void }) {
  const [available, setAvailable] = useState(false);
  const [nextStep, setNextStep] = useState('');
  const [nextAt, setNextAt] = useState('');
  const [session, setSession] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [seqNames, setSeqNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('leads').select('next_step, next_step_at, whatsapp_session' as never).eq('id', leadId).maybeSingle();
    setAvailable(!error);
    if (error) return;
    const row = data as unknown as { next_step: string | null; next_step_at: string | null; whatsapp_session: string | null };
    setNextStep(row?.next_step ?? '');
    setNextAt(row?.next_step_at ? new Date(new Date(row.next_step_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
    setSession(row?.whatsapp_session ?? null);
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase.from(ENR).select('id, sequence_id, step_index, next_at, status, last_error').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from(SEQS).select('id, name'),
    ]);
    setEnrollments((e ?? []) as unknown as Enrollment[]);
    setSeqNames(Object.fromEntries(((s ?? []) as unknown as { id: string; name: string }[]).map((x) => [x.id, x.name])));
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const saveNext = async () => {
    const { error } = await supabase.from('leads').update({
      next_step: nextStep.trim() || null, next_step_at: nextAt ? new Date(nextAt).toISOString() : null,
    } as never).eq('id', leadId);
    if (error) toast.error('Não foi possível salvar o próximo passo'); else toast.success('Próximo passo salvo');
  };

  const stop = async (id: string) => {
    await supabase.from(ENR).update({ status: 'parado', updated_at: new Date().toISOString() } as never).eq('id', id);
    load();
  };

  if (!available) return null;
  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto] sm:items-end">
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Próximo passo</Label>
          <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Ex.: ligar para apresentar a proposta" /></div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Quando</Label>
          <Input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} /></div>
        <Button variant="outline" onClick={saveNext}>Salvar</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EnrollButton leadId={leadId} session={session} small onDone={load} />
        {onOpenConversation && <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenConversation}><MessageCircle className="h-3.5 w-3.5" /> Conversa</Button>}
      </div>

      {enrollments.length > 0 && (
        <ul className="space-y-1.5">
          {enrollments.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-xs">
              <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{seqNames[e.sequence_id] ?? 'Sequência'}</span>
              <span className="text-muted-foreground">msg {Math.min(e.step_index + (e.status === 'ativo' ? 1 : 0), 99)}</span>
              <span className={cn('font-medium', STATUS[e.status]?.tone)} title={e.last_error || undefined}>{STATUS[e.status]?.label ?? e.status}</span>
              {e.status === 'ativo' && <button onClick={() => stop(e.id)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted" aria-label="Parar"><Square className="h-3 w-3" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
