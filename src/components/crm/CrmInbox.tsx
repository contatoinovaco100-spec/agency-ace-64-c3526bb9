import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Search, Send, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EnrollButton } from '@/components/crm/LeadExtras';
import { QuickReplyButton, SlashMenu, countUse, fillReply, matchReplies, useQuickReplies, type QuickReply } from '@/components/crm/QuickReplies';

type Conversation = {
  id: string; session_id: string; contact_phone: string; contact_name: string; last_message: string;
  last_message_at: string; unread_count: number; lead_id: string | null; client_id: string | null;
};
type Message = { id: string; direction: 'in' | 'out'; content: string; type: string; created_at: string; status: string };
type NumberRow = { id: string; name: string };

const CONVS = 'wa_conversations' as never;
const MSGS = 'wa_messages' as never;

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

/** Caixa de conversas do WhatsApp: todas as conversas dos números conectados, ligadas aos leads */
export function CrmInbox({ openConversationFor }: { openConversationFor?: string | null }) {
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [leads, setLeads] = useState<Record<string, { name: string; company: string; stage: string }>>({});
  const [filterNumber, setFilterNumber] = useState('todos');
  const [onlyLeads, setOnlyLeads] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error }, { data: n }] = await Promise.all([
      supabase.from(CONVS).select('*').order('last_message_at', { ascending: false }).limit(300),
      supabase.from('wa_numbers' as never).select('id, name'),
    ]);
    setMissing(!!error);
    const list = ((data ?? []) as unknown as Conversation[]);
    setConvs(list);
    setNumbers((n ?? []) as unknown as NumberRow[]);
    const ids = [...new Set(list.map((c) => c.lead_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: l } = await supabase.from('leads').select('id, name, company, stage').in('id', ids);
      setLeads(Object.fromEntries((l ?? []).map((x) => [x.id, x])));
    }
  }, []);

  useEffect(() => {
    load();
    // Atualiza na hora quando chega mensagem (Realtime); se não houver, a cada 20s
    const channel = supabase.channel('crm-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => load())
      .subscribe();
    const poll = setInterval(load, 20000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [load]);

  // Abrir direto a conversa de um lead (vindo do pipeline)
  useEffect(() => {
    if (!openConversationFor || !convs) return;
    const c = convs.find((x) => x.lead_id === openConversationFor);
    if (c) setOpenId(c.id);
  }, [openConversationFor, convs]);

  const numberName = (id: string) => numbers.find((n) => n.id === id)?.name ?? id;
  const visible = (convs ?? []).filter((c) =>
    (filterNumber === 'todos' || c.session_id === filterNumber)
    && (!onlyLeads || !!c.lead_id)
    && (!search.trim() || `${c.contact_name} ${c.contact_phone} ${c.lead_id ? leads[c.lead_id]?.company ?? '' : ''}`.toLowerCase().includes(search.toLowerCase())));
  const open = convs?.find((c) => c.id === openId) ?? null;

  if (missing) return <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">A caixa de conversas ainda não está no banco. Peça ao Lovable para aplicar a migração <code>20261030210000_crm_whatsapp.sql</code>.</p>;
  if (!convs) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid h-[calc(100dvh-260px)] min-h-[480px] overflow-hidden rounded-xl border bg-card md:grid-cols-[320px_1fr]">
      {/* Lista */}
      <div className={cn('flex min-h-0 flex-col border-r', open && 'hidden md:flex')}>
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar conversa" className="pl-8" />
          </div>
          {/* Uma aba por número, com as não lidas de cada um */}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {[{ id: 'todos', name: 'Todos' }, ...numbers].map((n) => {
              const unread = (convs ?? []).filter((c) => n.id === 'todos' || c.session_id === n.id).reduce((t, c) => t + (c.unread_count || 0), 0);
              return (
                <button key={n.id} onClick={() => setFilterNumber(n.id)}
                  className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors',
                    filterNumber === n.id ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  {n.name}
                  {unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">{unread}</span>}
                </button>
              );
            })}
            <button onClick={() => setOnlyLeads((v) => !v)}
              className={cn('ml-auto h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium', onlyLeads ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground')}>
              Só leads
            </button>
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground [text-wrap:pretty]">
              Nenhuma conversa ainda. As mensagens novas aparecem aqui assim que chegam. Para trazer o histórico de um número, desconecte e conecte de novo pelo QR (aba Números do WhatsApp): o celular envia as conversas dos últimos 30 dias.
            </li>
          )}
          {visible.map((c) => {
            const lead = c.lead_id ? leads[c.lead_id] : null;
            return (
              <li key={c.id}>
                <button onClick={() => setOpenId(c.id)} className={cn('flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-foreground/[0.03]', openId === c.id && 'bg-primary/[0.07]')}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {(c.contact_name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{lead?.company || c.contact_name || fmtPhone(c.contact_phone)}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c.last_message_at)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{c.last_message}</span>
                      {c.unread_count > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground">{c.unread_count}</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {filterNumber === 'todos' && numbers.length > 1 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{numberName(c.session_id)}</span>}
                      {lead && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{lead.stage}</span>}
                      {c.client_id && <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">Cliente</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Conversa */}
      {open ? (
        <Thread key={open.id} conv={open} numberName={numberName(open.session_id)} lead={open.lead_id ? leads[open.lead_id] : null}
          onBack={() => setOpenId(null)} onChanged={load} />
      ) : (
        <div className="hidden items-center justify-center p-8 text-center text-sm text-muted-foreground md:flex">Escolha uma conversa.</div>
      )}
    </div>
  );
}

function Thread({ conv, numberName, lead, onBack, onChanged }: {
  conv: Conversation; numberName: string; lead: { name: string; company: string; stage: string } | null; onBack: () => void; onChanged: () => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const quick = useQuickReplies();
  const [slashActive, setSlashActive] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);

  // "/" no começo da mensagem (sem espaço depois) abre as respostas rápidas
  const slash = /^\/(\S*)$/.exec(text);
  const slashItems = slash && !slashClosed && !quick.missing ? matchReplies(quick.replies, slash[1].toLowerCase()) : null;

  /** Insere a resposta rápida com {nome} e {empresa} da conversa */
  const pickReply = (r: QuickReply) => {
    const nome = String(lead?.name || conv.contact_name || '').trim().split(/\s+/)[0];
    const filled = fillReply(r.message, { nome: /^\d+$/.test(nome) ? '' : nome, empresa: lead?.company || '' });
    setText((t) => (slash ? filled : t ? `${t}${t.endsWith(' ') || t.endsWith('\n') ? '' : ' '}${filled}` : filled));
    setSlashActive(0);
    countUse(r);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from(MSGS).select('id, direction, content, type, created_at, status')
      .eq('conversation_id', conv.id).order('created_at').limit(500);
    setMessages((data ?? []) as unknown as Message[]);
  }, [conv.id]);

  useEffect(() => {
    load();
    // Zera as não lidas ao abrir
    if (conv.unread_count) supabase.from(CONVS).update({ unread_count: 0 } as never).eq('id', conv.id).then(() => onChanged());
    const channel = supabase.channel(`thread-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${conv.id}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('wa-server', {
      body: { action: 'send', to: conv.contact_phone, message, session: conv.session_id, lead_id: conv.lead_id },
    });
    setSending(false);
    if (error || data?.error) { toast.error('Mensagem não enviada', { description: data?.error ?? 'Confira se o número está conectado.' }); return; }
    setText('');
    load(); onChanged();
  };

  const createLead = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: me } = await supabase.from('profiles').select('full_name').eq('id', u.user?.id ?? '').maybeSingle();
    const { data, error } = await supabase.from('leads').insert({
      name: conv.contact_name || conv.contact_phone, company: conv.contact_name || '', phone: conv.contact_phone,
      source: 'WhatsApp', stage: 'Lead novo', assignee: me?.full_name ?? '', email: '', notes: '', estimated_value: 0,
      owner_id: u.user?.id ?? null, whatsapp_session: conv.session_id,
    } as never).select('id').single();
    if (error) { toast.error('Não foi possível criar o lead', { description: error.message }); return; }
    await supabase.from(CONVS).update({ lead_id: (data as { id: string }).id } as never).eq('id', conv.id);
    toast.success('Lead criado no pipeline');
    onChanged();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b p-3">
        <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted md:hidden" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{lead?.company || conv.contact_name || fmtPhone(conv.contact_phone)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lead ? `${lead.name} · ${lead.stage}` : fmtPhone(conv.contact_phone)} · pelo número {numberName}
          </p>
        </div>
        {conv.lead_id
          ? <EnrollButton leadId={conv.lead_id} session={conv.session_id} small />
          : !conv.client_id && <Button size="sm" variant="outline" className="gap-1.5" onClick={createLead}><UserPlus className="h-3.5 w-3.5" /> Virar lead</Button>}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
        {!messages ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : messages.map((m) => (
            <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-xl px-3 py-2 text-sm shadow-sm',
                m.direction === 'out' ? 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]' : 'bg-card')}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        <div ref={endRef} />
      </div>

      <div className="relative flex items-end gap-2 border-t p-3">
        {slashItems && <SlashMenu items={slashItems} active={slashActive} onPick={pickReply} />}
        <QuickReplyButton replies={quick.replies} missing={quick.missing} onPick={pickReply} onChanged={quick.reload} />
        <Textarea ref={inputRef} value={text} rows={1} placeholder="Escreva uma mensagem ou / para respostas rápidas"
          onChange={(e) => { setText(e.target.value); setSlashActive(0); setSlashClosed(false); }}
          onKeyDown={(e) => {
            if (slashItems?.length) {
              const max = Math.min(slashItems.length, 8);
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashActive((i) => (i + 1) % max); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSlashActive((i) => (i - 1 + max) % max); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickReply(slashItems[slashActive] ?? slashItems[0]); return; }
              if (e.key === 'Escape') { e.preventDefault(); setSlashClosed(true); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          className="max-h-32 min-h-[40px] resize-none" />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" aria-label="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

