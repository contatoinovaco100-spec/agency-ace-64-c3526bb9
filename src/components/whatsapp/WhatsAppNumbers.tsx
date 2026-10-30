import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, QrCode, Smartphone, Trash2, Unplug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Número no servidor (sessão) + dados da plataforma (tipo, área, dono, captura) */
type Session = { id: string; name: string; status: string; number: string | null; hasQR: boolean };
type NumberMeta = { id: string; name: string; kind: 'area' | 'vendedor'; area: string; owner_id: string | null; capture_leads: boolean; is_default: boolean };
type Profile = { id: string; full_name: string };

const NUMBERS = 'wa_numbers' as never;

async function wa<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('wa-server', { body });
  if (error || (data as { error?: string })?.error) {
    let msg = (data as { error?: string })?.error;
    if (!msg) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* sem corpo */ } }
    throw new Error(msg || 'Servidor do WhatsApp indisponível');
  }
  return data as T;
}

/** Aba "Números": conectar vários WhatsApp (por área ou por vendedor) com QR dentro da plataforma */
export function WhatsAppNumbers() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [meta, setMeta] = useState<Record<string, NumberMeta>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [qrFor, setQrFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ sessions: list }, { data: m }, { data: p }] = await Promise.all([
        wa<{ sessions: Session[] }>({ action: 'sessions' }),
        supabase.from(NUMBERS).select('*'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).not('username', 'is', null).not('full_name', 'is', null).order('full_name'),
      ]);
      setSessions(list); setError(null);
      setMeta(Object.fromEntries(((m ?? []) as unknown as NumberMeta[]).map((x) => [x.id, x])));
      setProfiles((p ?? []) as Profile[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setSessions([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveMeta = async (id: string, patch: Partial<NumberMeta>) => {
    const current = meta[id] ?? { id, name: sessions?.find((s) => s.id === id)?.name ?? '', kind: 'area', area: '', owner_id: null, capture_leads: false, is_default: false };
    const next = { ...current, ...patch };
    setMeta((m) => ({ ...m, [id]: next }));
    if (patch.is_default) await supabase.from(NUMBERS).update({ is_default: false } as never).neq('id', id);
    const { error: e } = await supabase.from(NUMBERS).upsert(next as never);
    if (e) toast.error('Não foi possível salvar', { description: (e as { message: string }).message });
    if (patch.is_default) load();
  };

  const add = async () => {
    try {
      const s = await wa<Session>({ action: 'create', name: newName.trim() || 'Novo número' });
      await supabase.from(NUMBERS).upsert({ id: s.id, name: s.name, kind: 'area', area: '', capture_leads: false, is_default: false } as never);
      setAdding(false); setNewName('');
      await load();
      setQrFor(s.id);
    } catch (e) { toast.error('Não foi possível adicionar', { description: e instanceof Error ? e.message : '' }); }
  };

  const remove = async (s: Session) => {
    if (!confirm(`Remover o número "${s.name}"? Ele é desconectado do WhatsApp.`)) return;
    try { await wa({ action: 'remove', session: s.id }); await supabase.from(NUMBERS).delete().eq('id', s.id); load(); }
    catch (e) { toast.error('Não foi possível remover', { description: e instanceof Error ? e.message : '' }); }
  };

  const disconnect = async (s: Session) => {
    if (!confirm(`Desconectar "${s.name}"? Vai precisar escanear o QR de novo.`)) return;
    try { await wa({ action: 'logout', session: s.id }); toast.success('Desconectado'); setTimeout(load, 2000); }
    catch (e) { toast.error('Não foi possível desconectar', { description: e instanceof Error ? e.message : '' }); }
  };

  if (!sessions) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">{error}. Confira se a função <code>wa-server</code> está publicada no Lovable.</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Cada número conecta por QR Code. Use números de área (comercial, atendimento) ou de cada vendedor.</p>
        <Button className="shrink-0 gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Adicionar número</Button>
      </div>

      <ul className="space-y-3">
        {sessions.map((s) => {
          const m = meta[s.id];
          const ok = s.status === 'CONNECTED';
          return (
            <li key={s.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', ok ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                  <Smartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m?.name || s.name}{m?.is_default && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Principal</span>}</p>
                  <p className={cn('text-xs', ok ? 'text-muted-foreground' : 'text-warning')}>{ok ? `+${s.number}` : s.status === 'QR_CODE' ? 'Esperando o QR Code' : 'Desconectado'}</p>
                </div>
                {!ok && <Button size="sm" className="gap-1.5" onClick={() => setQrFor(s.id)}><QrCode className="h-3.5 w-3.5" /> Conectar</Button>}
                {ok && <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => disconnect(s)}><Unplug className="h-3.5 w-3.5" /> Desconectar</Button>}
                {s.id !== 'default' && <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input defaultValue={m?.name || s.name} onBlur={(e) => {
                    const v = e.target.value.trim(); if (v && v !== (m?.name || s.name)) { saveMeta(s.id, { name: v }); wa({ action: 'rename', session: s.id, name: v }).catch(() => {}); }
                  }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={m?.kind ?? 'area'} onValueChange={(v) => saveMeta(s.id, { kind: v as NumberMeta['kind'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="area">Área da empresa</SelectItem><SelectItem value="vendedor">De um vendedor</SelectItem></SelectContent>
                  </Select>
                </div>
                {(m?.kind ?? 'area') === 'vendedor' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vendedor</Label>
                    <Select value={m?.owner_id ?? ''} onValueChange={(v) => saveMeta(s.id, { owner_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Área</Label>
                    <Select value={m?.area || ''} onValueChange={(v) => saveMeta(s.id, { area: v })}>
                      <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                      <SelectContent>
                        {['comercial', 'atendimento', 'financeiro', 'produção', 'geral'].map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={!!m?.capture_leads} onCheckedChange={(v) => saveMeta(s.id, { capture_leads: v })} /> Contato novo vira lead
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={!!m?.is_default} onCheckedChange={(v) => v && saveMeta(s.id, { is_default: true })} /> Número principal
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Adicionar número</DialogTitle>
          <DialogDescription>Dê um nome (ex.: Comercial, Atendimento, Lucas). Depois é só escanear o QR Code.</DialogDescription>
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do número" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button onClick={add} className="w-full">Adicionar e mostrar QR Code</Button>
        </DialogContent>
      </Dialog>

      {qrFor && <QrDialog session={qrFor} onClose={() => { setQrFor(null); load(); }} />}
    </div>
  );
}

/** QR Code do número, atualizado a cada 3 segundos até conectar */
function QrDialog({ session, onClose }: { session: string; onClose: () => void }) {
  const [state, setState] = useState<{ status: string; qr: string | null; number: string | null; name: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await wa<{ status: string; qr: string | null; number: string | null; name: string }>({ action: 'qr', session });
        if (alive) setState(d);
        if (d.status === 'CONNECTED') { toast.success(`${d.name} conectado`); setTimeout(onClose, 1500); return; }
      } catch { /* tenta de novo */ }
      if (alive) setTimeout(tick, 3000);
    };
    tick();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogTitle>Conectar {state?.name ?? 'número'}</DialogTitle>
        <DialogDescription>No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.</DialogDescription>
        <div className="flex min-h-[280px] items-center justify-center">
          {state?.status === 'CONNECTED' ? <p className="font-medium text-success">✅ Conectado: +{state.number}</p>
            : state?.qr ? <img src={state.qr} alt="QR Code do WhatsApp" className="h-64 w-64 rounded-lg bg-white p-2" />
            : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
