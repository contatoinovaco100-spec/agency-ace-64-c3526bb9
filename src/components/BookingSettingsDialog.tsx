import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Copy, ExternalLink, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Settings = {
  weekdays: number[]; start_time: string; end_time: string; slot_minutes: number;
  min_notice_days: number; horizon_days: number; blocked_dates: string[]; location: string;
  /** Equipes que gravam ao mesmo tempo: quantos clientes cabem no mesmo horário */
  teams_per_slot?: number;
};

const DEFAULTS: Settings = { weekdays: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '18:00', slot_minutes: 120, min_notice_days: 1, horizon_days: 30, blocked_dates: [], location: '', teams_per_slot: 2 };
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }); };

// Tabela nova, ainda fora dos tipos gerados do Supabase
const settingsTable = () => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('shooting_booking_settings');

export const bookingLink = (clientId: string) => `${window.location.origin}/agendar/${clientId}`;

/** Regras da agenda que o cliente vê no link /agendar e o link de cada cliente para copiar */
export function BookingSettingsDialog() {
  const { clients } = useAgency();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [saving, setSaving] = useState(false);
  const [blockDay, setBlockDay] = useState('');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await settingsTable().select('*').eq('id', 1).maybeSingle();
      if (error) { setState('missing'); return; }
      const row = data as unknown as Settings | null;
      if (row) setS({ ...row, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) });
      setState('ready');
    })();
  }, [open]);

  const active = useMemo(() => clients
    .filter((c) => !c.deletedAt && c.status !== 'Cancelado')
    .filter((c) => !q || c.companyName.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.companyName.localeCompare(b.companyName)), [clients, q]);

  const slotsPerDay = useMemo(() => {
    const [sh, sm] = s.start_time.split(':').map(Number); const [eh, em] = s.end_time.split(':').map(Number);
    return Math.max(0, Math.floor(((eh * 60 + em) - (sh * 60 + sm)) / (s.slot_minutes || 1)));
  }, [s]);

  const save = async () => {
    if (!s.weekdays.length) { toast.error('Escolha pelo menos um dia da semana'); return; }
    if ((s.teams_per_slot ?? 1) < 1) { toast.error('Precisa de pelo menos 1 equipe'); return; }
    if (slotsPerDay < 1) { toast.error('A janela de horário não comporta nenhuma captação'); return; }
    setSaving(true);
    // Sem a migração das equipes a coluna não existe: salva o resto
    const { teams_per_slot, ...rest } = s;
    const payload = teams_per_slot === undefined ? rest : s;
    const { error } = await settingsTable().update({ ...payload, updated_at: new Date().toISOString() } as never).eq('id', 1);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    toast.success('Agenda de captação salva');
  };

  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(bookingLink(id)); } catch { toast.error('Não foi possível copiar'); return; }
    setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const toggleDay = (d: number) => setS((p) => ({ ...p, weekdays: p.weekdays.includes(d) ? p.weekdays.filter((x) => x !== d) : [...p.weekdays, d].sort() }));
  const addBlocked = () => {
    if (!blockDay || s.blocked_dates.includes(blockDay)) return;
    setS((p) => ({ ...p, blocked_dates: [...p.blocked_dates, blockDay].sort() })); setBlockDay('');
  };
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: Number(e.target.value) || 0 }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><CalendarClock className="mr-2 h-4 w-4" />Link de agendamento</Button></DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendamento pelo cliente</DialogTitle>
          <DialogDescription>O cliente abre o link dele, escolhe um horário livre e a captação entra aqui na agenda com o nome dele.</DialogDescription>
        </DialogHeader>

        {state === 'loading' && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {state === 'missing' && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            Falta aplicar a migração <code className="text-xs">20261103090000_shooting_booking</code> no Lovable para o agendamento funcionar.
          </p>
        )}

        {state === 'ready' && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Horários que o cliente pode escolher</h3>
              <fieldset disabled={!isAdmin} className="space-y-3 disabled:opacity-70">
                <div>
                  <Label className="text-xs text-muted-foreground">Dias da semana</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((w, i) => (
                      <button key={w} type="button" onClick={() => toggleDay(i)}
                        className={cn('h-9 w-12 rounded-md border text-sm font-medium transition-colors',
                          s.weekdays.includes(i) ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:border-foreground/30')}>
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div><Label className="text-xs text-muted-foreground">Começa às</Label><Input type="time" value={s.start_time} onChange={(e) => setS({ ...s, start_time: e.target.value })} /></div>
                  <div><Label className="text-xs text-muted-foreground">Termina às</Label><Input type="time" value={s.end_time} onChange={(e) => setS({ ...s, end_time: e.target.value })} /></div>
                  {s.teams_per_slot !== undefined && (
                    <div><Label className="text-xs text-muted-foreground">Equipes no mesmo horário</Label><Input type="number" min={1} max={20} value={s.teams_per_slot} onChange={num('teams_per_slot')} /></div>
                  )}
                  <div><Label className="text-xs text-muted-foreground">Duração (min)</Label><Input type="number" min={15} step={15} value={s.slot_minutes} onChange={num('slot_minutes')} /></div>
                  <div><Label className="text-xs text-muted-foreground">Antecedência (dias)</Label><Input type="number" min={0} value={s.min_notice_days} onChange={num('min_notice_days')} /></div>
                  <div><Label className="text-xs text-muted-foreground">Abre até (dias à frente)</Label><Input type="number" min={1} max={180} value={s.horizon_days} onChange={num('horizon_days')} /></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const teams = s.teams_per_slot ?? 1; const total = slotsPerDay * teams;
                    return `${slotsPerDay === 1 ? '1 horário' : `${slotsPerDay} horários`} por dia${teams > 1 ? ` × ${teams} equipes = ${total} captações por dia` : ''}.`;
                  })()} Gravação sem horário ocupa uma equipe o dia todo.
                </p>
                <div><Label className="text-xs text-muted-foreground">Local (aparece para o cliente)</Label><Input value={s.location} onChange={(e) => setS({ ...s, location: e.target.value })} placeholder="Ex: Estúdio INOVA, ou no endereço do cliente" /></div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dias fechados (folga, feriado, viagem)</Label>
                  <div className="mt-1 flex gap-2">
                    <Input type="date" value={blockDay} onChange={(e) => setBlockDay(e.target.value)} className="w-44" />
                    <Button type="button" variant="outline" onClick={addBlocked} disabled={!blockDay}>Fechar dia</Button>
                  </div>
                  {s.blocked_dates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.blocked_dates.map((d) => (
                        <span key={d} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                          {fmtDay(d)}
                          <button type="button" aria-label={`Abrir ${fmtDay(d)}`} onClick={() => setS((p) => ({ ...p, blocked_dates: p.blocked_dates.filter((x) => x !== d) }))}
                            className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>
              {isAdmin
                ? <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar horários</Button>
                : <p className="text-xs text-muted-foreground">Só o admin altera os horários.</p>}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Link de cada cliente</h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="pl-8" />
              </div>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {active.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.companyName}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild aria-label="Abrir link">
                      <a href={bookingLink(c.id)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(c.id)} className="w-28">
                      {copied === c.id ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copiado</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</>}
                    </Button>
                  </li>
                ))}
                {active.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum cliente</li>}
              </ul>
              <p className="text-xs text-muted-foreground">A automação "Datas livres para captação" no WhatsApp já manda esse link com as próximas datas.</p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
