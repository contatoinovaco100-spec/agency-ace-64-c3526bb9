import { useEffect, useState } from 'react';
import { Bot, Loader2, Mic, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Tabelas novas, ainda fora dos tipos gerados do Supabase
const table = (t: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(t);

type Settings = { enabled: boolean; session_id: string; group_id: string; group_name: string; allow_actions: boolean; trigger_word: string };
type WaNumber = { id: string; name: string; is_default: boolean };
type LogRow = { id: string; sender: string; question: string; via_audio: boolean; answer: string; actions: { tool: string; ok: boolean; resumo: string }[]; created_at: string };

const EXAMPLES = [
  { kind: 'Consultar', items: ['Como está o dia hoje?', 'Quais posts da Clínica X estão atrasados?', 'Quanto está o MRR e quem está com fatura atrasada?', 'Quais leads estão parados há mais de 7 dias?'] },
  { kind: 'Fazer', items: ['Cria um card de Reels para a Clínica X, postar sexta às 18h, responsável Ana', 'Move o card "Black Friday" da Loja Y para Revisão', 'Agenda gravação da Clínica X dia 10 às 14h', 'Registra gasto de 120 reais com gasolina', 'Publica aviso no kanban: sexta não tem expediente'] },
];

/** Administração → Assistente do WhatsApp: em qual grupo ele responde e o que pode fazer */
export default function WaAssistantPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [q, setQ] = useState('');
  const [trigger, setTrigger] = useState('inova');

  const load = async () => {
    const { data, error } = await table('wa_assistant_settings').select('*').eq('id', 1).maybeSingle();
    if (error) { setState('missing'); return; }
    setSettings({ enabled: false, session_id: '', group_id: '', group_name: '', allow_actions: true, trigger_word: 'inova', ...(data ?? {}) } as Settings);
    setTrigger(String((data as { trigger_word?: string } | null)?.trigger_word ?? 'inova'));
    const { data: l } = await table('wa_assistant_log').select('*').order('created_at', { ascending: false }).limit(30);
    setLog((l ?? []) as unknown as LogRow[]);
    setState('ready');
  };
  useEffect(() => {
    load();
    supabase.from('wa_numbers' as never).select('id, name, is_default').order('name')
      .then(({ data }) => setNumbers((data ?? []) as unknown as WaNumber[]));
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await table('wa_assistant_settings').upsert({ id: 1, ...next, updated_at: new Date().toISOString() } as never);
    if (error) {
      toast.error('Não foi possível salvar', { description: /trigger_word/.test(error.message) ? 'Falta aplicar a migração 20261103180000_wa_assistant_trigger.' : error.message });
      load();
    }
  };

  const session = settings?.session_id || numbers.find((n) => n.is_default)?.id || numbers[0]?.id || '';

  const openGroups = async (sess = session) => {
    setLoadingGroups(true);
    const { data, error } = await supabase.functions.invoke('wa-server', { body: { action: 'groups', session: sess || undefined } });
    setLoadingGroups(false);
    if (error || data?.error) {
      toast.error('Não foi possível listar os grupos', { description: data?.error || 'Confira se o número está conectado em CRM → Números do WhatsApp.' });
      return;
    }
    setQ('');
    setGroups((data?.groups ?? []) as { id: string; name: string }[]);
  };

  const pick = async (g: { id: string; name: string }) => {
    await save({ group_id: g.id, group_name: g.name, session_id: session, enabled: true });
    setGroups(null);
    toast.success(`Assistente ligado no grupo "${g.name}"`, { description: 'Mande uma pergunta no grupo para testar.' });
  };

  const shown = (groups ?? []).filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistente do WhatsApp"
        description="Responde só no grupo que você escolher: consulta a plataforma e executa ações por texto ou áudio. Quem estiver no grupo pode usar, então deixe só quem você confia."
      />

      {state === 'loading' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {state === 'missing' && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          Falta aplicar a migração <code className="text-xs">20261103170000_wa_assistant</code> no Lovable.
        </p>
      )}

      {state === 'ready' && settings && (
        <>
          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">Assistente ligado</p>
                <p className="text-sm text-muted-foreground">Desligado, o grupo vira uma conversa comum do CRM.</p>
              </div>
              <Switch checked={settings.enabled} disabled={!settings.group_id} onCheckedChange={(v) => save({ enabled: v })} aria-label="Ligar o assistente" />
            </div>

            {numbers.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">Número que está no grupo</p>
                <div className="flex flex-wrap gap-1.5">
                  {numbers.map((n) => (
                    <button key={n.id} type="button" onClick={() => save({ session_id: n.id, group_id: '', group_name: '', enabled: false })}
                      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        session === n.id ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:border-foreground/30')}>
                      {n.name}{n.is_default ? ' (principal)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Grupo do assistente</p>
                  <p className="truncate text-sm font-medium text-foreground">{settings.group_name || 'Nenhum grupo escolhido'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openGroups()} disabled={loadingGroups}>
                {loadingGroups && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{settings.group_id ? 'Trocar grupo' : 'Escolher grupo'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="assistant-trigger" className="text-sm font-medium text-foreground">Palavra-gatilho</label>
              <Input id="assistant-trigger" value={trigger} maxLength={30} placeholder="Ex.: inova"
                onChange={(e) => setTrigger(e.target.value)}
                onBlur={() => { const t = trigger.trim(); if (t !== settings.trigger_word) save({ trigger_word: t }); }} />
              <p className="text-xs text-muted-foreground">
                {settings.trigger_word
                  ? <>Ele só responde mensagens e áudios que começam com "<strong className="font-medium text-foreground">{settings.trigger_word}</strong>". O resto da conversa no grupo ele ignora.</>
                  : 'Sem palavra-gatilho ele responde toda mensagem do grupo.'}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">Pode executar ações</p>
                <p className="text-sm text-muted-foreground">Criar e mover cards, criar leads, agendar gravação, registrar gasto, publicar aviso. Desligado, ele só consulta.</p>
              </div>
              <Switch checked={settings.allow_actions} onCheckedChange={(v) => save({ allow_actions: v })} aria-label="Permitir ações" />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <div key={ex.kind} className="rounded-xl border bg-card p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{ex.kind}</p>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {ex.items.map((i) => <li key={i}>"{settings.trigger_word ? `${settings.trigger_word[0].toUpperCase()}${settings.trigger_word.slice(1)}, ${i[0].toLowerCase()}${i.slice(1)}` : i}"</li>)}
                </ul>
              </div>
            ))}
            <p className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
              <Mic className="h-3.5 w-3.5" /> Também funciona com áudio: comece falando {settings.trigger_word ? `"${settings.trigger_word}"` : 'o pedido'} e ele responde por escrito.
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">Últimos pedidos</h2>
            {log.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"><Bot className="h-4 w-4" />Nenhum pedido ainda.</p>
            ) : (
              <ul className="divide-y">
                {log.map((r) => (
                  <li key={r.id} className="space-y-1 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {r.sender ? ` · ${r.sender}` : ''}{r.via_audio ? ' · áudio' : ''}
                    </p>
                    <p className="text-sm font-medium text-foreground">{r.question}</p>
                    {r.actions?.map((a, i) => (
                      <p key={i} className={cn('text-xs font-medium', a.ok ? 'text-success' : 'text-destructive')}>{a.ok ? 'Feito' : 'Falhou'}: {a.resumo}</p>
                    ))}
                    <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{r.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {groups && (
        <Dialog open onOpenChange={(o) => !o && setGroups(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Escolher o grupo do assistente</DialogTitle>
            <DialogDescription>Crie no WhatsApp um grupo só com você (e quem puder usar) e o número da INOVA, depois escolha ele aqui.</DialogDescription>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar grupo" />
            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
            ) : (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {shown.map((g) => (
                  <li key={g.id}>
                    <button type="button" onClick={() => pick(g)}
                      className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40',
                        g.id === settings?.group_id && 'border-primary')}>
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
