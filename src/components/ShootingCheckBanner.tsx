import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, Clock, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';

type Shooting = { id: string; title: string; shooting_date: string; start_time: string | null; client_id: string | null; status: string };

/** A partir dessa hora o admin confirma as gravações do dia */
const CHECK_HOUR = 17;
/** Gravações de dias anteriores sem confirmação continuam aparecendo por até 14 dias */
const LOOKBACK_DAYS = 14;
const SNOOZE_KEY = 'shooting-check:snooze';
const SNOOZE_MS = 60 * 60_000;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayLabel = (day: string, today: string) => {
  if (day === today) return 'hoje';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

/**
 * Aviso no topo de todas as telas para o admin: a partir das 17h, confirmar se as gravações do dia foram
 * realizadas (e as de dias anteriores que ficaram sem resposta). "Realizada" marca como Concluída;
 * "Não aconteceu" marca como Cancelada; "Depois" esconde por 1 hora.
 */
export function ShootingCheckBanner() {
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<Shooting[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = isoDay(now);
  const afterHour = now.getHours() >= CHECK_HOUR;
  let snoozedUntil = 0;
  try { snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch { /* armazenamento indisponível */ }
  const snoozed = snoozedUntil > now.getTime();

  const load = useCallback(async () => {
    const from = new Date(); from.setDate(from.getDate() - LOOKBACK_DAYS);
    const { data } = await supabase.from('shooting_schedules')
      .select('id, title, shooting_date, start_time, client_id, status')
      .gte('shooting_date', isoDay(from)).lte('shooting_date', isoDay(new Date()))
      .not('status', 'in', '("Concluída","Cancelada")')
      .order('shooting_date').order('start_time');
    const list = (data ?? []) as Shooting[];
    setItems(list);
    const ids = [...new Set(list.map((s) => s.client_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: c } = await supabase.from('clients').select('id, company_name').in('id', ids);
      setClients(Object.fromEntries((c ?? []).map((x) => [x.id, x.company_name])));
    }
  }, []);

  // Busca ao virar 17h e a cada 10 minutos depois (outra pessoa pode ter confirmado)
  const tick = Math.floor(now.getTime() / 600_000);
  useEffect(() => {
    if (isAdmin && afterHour) load();
  }, [isAdmin, afterHour, tick, load]);

  // As de hoje e as de dias anteriores que ficaram sem resposta
  const pending = items.filter((s) => s.shooting_date <= today);
  if (!isAdmin || !afterHour || snoozed || pending.length === 0) return null;

  const answer = async (s: Shooting, status: 'Concluída' | 'Cancelada') => {
    setBusy(s.id);
    const { error } = await supabase.from('shooting_schedules').update({ status }).eq('id', s.id);
    setBusy(null);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    toast.success(status === 'Concluída' ? `"${s.title}" marcada como realizada` : `"${s.title}" marcada como não realizada`);
  };

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* armazenamento indisponível */ }
    setNow(new Date());
  };

  return (
    <div role="dialog" aria-label="Confirmar gravações" className="fixed inset-x-0 top-3 z-[60] flex justify-center px-3">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-2xl animate-in fade-in slide-in-from-top-4">
        <div className="flex items-start gap-3 border-b p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Camera className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">As gravações foram realizadas?</p>
            <p className="text-xs text-muted-foreground">
              {pending.length === 1 ? '1 gravação esperando' : `${pending.length} gravações esperando`} a sua confirmação.
            </p>
          </div>
          <button onClick={snooze} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Lembrar daqui a 1 hora" title="Lembrar daqui a 1 hora">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[50vh] divide-y overflow-y-auto">
          {pending.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {dayLabel(s.shooting_date, today)}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}
                  {s.client_id && clients[s.client_id] ? ` · ${clients[s.client_id]}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => answer(s, 'Cancelada')}>Não aconteceu</Button>
                <Button size="sm" disabled={busy === s.id} onClick={() => answer(s, 'Concluída')} className="gap-1.5">
                  {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Realizada
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <Link to="/gravacoes" className="font-medium text-primary hover:underline">Abrir gravações</Link>
          <button onClick={snooze} className="hover:text-foreground">Lembrar daqui a 1 hora</button>
        </div>
      </div>
    </div>
  );
}
