import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type QuickReply = { id: string; shortcut: string; message: string; uses: number };

const TABLE = 'crm_quick_replies' as never;

/** Atalho limpo: sem barra, sem espaço, minúsculo ("/Bom Dia" → "bomdia") */
const cleanShortcut = (raw: string) => raw.trim().replace(/^\/+/, '').replace(/\s+/g, '').toLowerCase();

/** Troca {nome} e {empresa} pelos dados da conversa */
export const fillReply = (message: string, vars: { nome?: string; empresa?: string }) =>
  message.replace(/\{nome\}/gi, vars.nome ?? '').replace(/\{empresa\}/gi, vars.empresa ?? '');

/** Lista das respostas rápidas (as mais usadas primeiro); `missing` quando a tabela ainda não existe */
export function useQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from(TABLE).select('id, shortcut, message, uses').order('uses', { ascending: false }).order('shortcut');
    setMissing(!!error);
    setReplies((data ?? []) as unknown as QuickReply[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { replies, missing, reload: load };
}

/** Conta o uso (para as mais usadas subirem na lista) */
export const countUse = (r: QuickReply) =>
  supabase.from(TABLE).update({ uses: r.uses + 1 } as never).eq('id', r.id).then(() => null);

/** Respostas que combinam com o que foi digitado depois da "/" */
export const matchReplies = (replies: QuickReply[], query: string) => {
  const q = query.toLowerCase();
  if (!q) return replies;
  return [...replies.filter((r) => r.shortcut.startsWith(q)), ...replies.filter((r) => !r.shortcut.startsWith(q) && (r.shortcut.includes(q) || r.message.toLowerCase().includes(q)))];
};

/** Lista que aparece acima da caixa de mensagem ao digitar "/" */
export function SlashMenu({ items, active, onPick }: { items: QuickReply[]; active: number; onPick: (r: QuickReply) => void }) {
  return (
    <div className="absolute inset-x-3 bottom-full mb-2 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg" role="listbox">
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma resposta rápida com esse atalho.</p>
      ) : items.slice(0, 8).map((r, i) => (
        <button
          key={r.id}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => { e.preventDefault(); onPick(r); }}
          className={cn('flex w-full flex-col items-start rounded-lg px-3 py-2 text-left', i === active ? 'bg-muted' : 'hover:bg-muted/60')}
        >
          <span className="text-sm font-medium">/{r.shortcut}</span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{r.message}</span>
        </button>
      ))}
    </div>
  );
}

/** Botão ⚡ ao lado da caixa de mensagem: escolher uma resposta ou abrir o cadastro */
export function QuickReplyButton({ replies, missing, onPick, onChanged }: {
  replies: QuickReply[]; missing: boolean; onPick: (r: QuickReply) => void; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [filter, setFilter] = useState('');
  const shown = matchReplies(replies, cleanShortcut(filter));
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Respostas rápidas" title="Respostas rápidas (ou digite /)"><Zap className="h-4 w-4" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-80 p-2">
          {missing ? (
            <p className="p-2 text-xs text-muted-foreground">As respostas rápidas ainda não estão no banco. Peça ao Lovable para aplicar a migração <code>20261031010000_crm_quick_replies.sql</code>.</p>
          ) : (
            <>
              <Input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar atalho ou texto" className="mb-2 h-8" />
              <div className="max-h-64 overflow-y-auto">
                {shown.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{replies.length ? 'Nada encontrado.' : 'Nenhuma resposta rápida ainda.'}</p>}
                {shown.map((r) => (
                  <button key={r.id} onClick={() => { onPick(r); setOpen(false); setFilter(''); }} className="flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-muted">
                    <span className="text-sm font-medium">/{r.shortcut}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{r.message}</span>
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5" onClick={() => { setOpen(false); setManage(true); }}>
                <Pencil className="h-3.5 w-3.5" /> Gerenciar respostas rápidas
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
      {manage && <QuickRepliesManager replies={replies} onClose={() => setManage(false)} onChanged={onChanged} />}
    </>
  );
}

/** Lê o texto colado: cada resposta começa com "/atalho" na linha; o texto vai até o próximo "/atalho" */
export function parsePasted(text: string) {
  const out: { shortcut: string; message: string }[] = [];
  let current: { shortcut: string; lines: string[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*\/(\S+)\s*(.*)$/.exec(line);
    if (m) {
      if (current) out.push({ shortcut: current.shortcut, message: current.lines.join('\n').trim() });
      current = { shortcut: cleanShortcut(m[1]), lines: m[2] ? [m[2]] : [] };
    } else if (current) current.lines.push(line);
  }
  if (current) out.push({ shortcut: current.shortcut, message: current.lines.join('\n').trim() });
  return out.filter((r) => r.shortcut && r.message);
}

function QuickRepliesManager({ replies, onClose, onChanged }: { replies: QuickReply[]; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<{ id?: string; shortcut: string; message: string } | null>(null);
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  const parsed = parsePasted(pasted);

  const save = async () => {
    if (!editing) return;
    const shortcut = cleanShortcut(editing.shortcut);
    if (!shortcut || !editing.message.trim()) { toast.error('Preencha o atalho e a mensagem'); return; }
    setSaving(true);
    const row = { shortcut, message: editing.message.trim(), updated_at: new Date().toISOString() };
    const { data: u } = await supabase.auth.getUser();
    const { error } = editing.id
      ? await supabase.from(TABLE).update(row as never).eq('id', editing.id)
      : await supabase.from(TABLE).insert({ ...row, created_by: u.user?.id ?? null } as never);
    setSaving(false);
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? `Já existe o atalho /${shortcut}` : 'Não foi possível salvar', { description: error.message }); return; }
    setEditing(null); onChanged();
  };

  const remove = async (r: QuickReply) => {
    if (!confirm(`Apagar a resposta /${r.shortcut}?`)) return;
    await supabase.from(TABLE).delete().eq('id', r.id);
    onChanged();
  };

  const importPasted = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const existing = new Set(replies.map((r) => r.shortcut));
    let added = 0, updated = 0;
    for (const r of parsed) {
      const row = { shortcut: r.shortcut, message: r.message, updated_at: new Date().toISOString() };
      const { error } = existing.has(r.shortcut)
        ? await supabase.from(TABLE).update(row as never).eq('shortcut', r.shortcut)
        : await supabase.from(TABLE).insert({ ...row, created_by: u.user?.id ?? null } as never);
      if (!error) { if (existing.has(r.shortcut)) updated++; else added++; existing.add(r.shortcut); }
    }
    setSaving(false);
    toast.success(`${added} respostas adicionadas${updated ? ` · ${updated} atualizadas` : ''}`);
    setPasted(''); onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Respostas rápidas</DialogTitle>
        <DialogDescription>Na conversa, digite <strong>/</strong> e o atalho (ex.: /bomdia) para inserir o texto. Use {'{nome}'} para o primeiro nome do contato e {'{empresa}'} para a empresa.</DialogDescription>
        <Tabs defaultValue="list">
          <TabsList className="w-full">
            <TabsTrigger value="list" className="flex-1">Minhas respostas ({replies.length})</TabsTrigger>
            <TabsTrigger value="paste" className="flex-1">Colar várias</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {editing ? (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Atalho</Label>
                  <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span>
                    <Input autoFocus value={editing.shortcut} onChange={(e) => setEditing({ ...editing, shortcut: e.target.value })} placeholder="bomdia" /></div></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Mensagem</Label>
                  <Textarea rows={5} value={editing.message} onChange={(e) => setEditing({ ...editing, message: e.target.value })} placeholder="Bom dia, {nome}! Tudo bem?" /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setEditing({ shortcut: '', message: '' })}><Plus className="h-4 w-4" /> Nova resposta</Button>
            )}
            <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
              {replies.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nenhuma resposta ainda. Crie uma ou cole várias de uma vez.</li>}
              {replies.map((r) => (
                <li key={r.id} className="flex items-start gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">/{r.shortcut}</p>
                    <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.message}</p>
                  </div>
                  <button onClick={() => setEditing(r)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(r)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted" aria-label="Apagar"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3">
            <Textarea rows={10} value={pasted} onChange={(e) => setPasted(e.target.value)} className="font-mono text-xs"
              placeholder={'/bomdia\nBom dia, {nome}! Tudo bem?\n\n/valores\nNossos planos começam em...\nPosso te explicar melhor?\n\n/endereco Rua 33, Vila Santa Cecília'} />
            <p className="text-xs text-muted-foreground">
              Cada resposta começa numa linha com <strong>/atalho</strong>; a mensagem vai até o próximo atalho (pode ter várias linhas).
              Atalho que já existe é atualizado.
            </p>
            <Button onClick={importPasted} disabled={!parsed.length || saving} className="w-full">
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {parsed.length ? `Salvar ${parsed.length} resposta${parsed.length > 1 ? 's' : ''}` : 'Cole as respostas acima'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
