import { useEffect, useState } from 'react';
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KanbanNoticeBanner } from '@/components/tasks/KanbanNoticeBanner';
import { cn } from '@/lib/utils';
import { TONES, isLive, noticesTable, todayIso, type KanbanNotice } from '@/lib/kanbanNotices';

type Draft = Omit<KanbanNotice, 'id' | 'created_by' | 'updated_at'> & { id?: string };
const emptyNotice = (): Draft => ({ title: '', message: '', tone: 'destaque', link: '', starts_on: null, ends_on: null, enabled: true });
const shortDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

/** Administração → Avisos do kanban: banner que aparece no topo do kanban de todo mundo */
export default function KanbanNoticesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<KanbanNotice[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<KanbanNotice | null>(null);
  const today = todayIso();

  const load = async () => {
    const { data, error } = await noticesTable().select('*').order('created_at', { ascending: false });
    if (error) { setState('missing'); return; }
    setList((data ?? []) as unknown as KanbanNotice[]);
    setState('ready');
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { toast.error('Escreva o título do aviso'); return; }
    if (draft.starts_on && draft.ends_on && draft.ends_on < draft.starts_on) { toast.error('A data final vem antes da inicial'); return; }
    setSaving(true);
    const { id, ...row } = {
      ...draft, title: draft.title.trim(), message: draft.message.trim(), link: draft.link.trim(),
      starts_on: draft.starts_on || null, ends_on: draft.ends_on || null, updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await noticesTable().update(row as never).eq('id', id)
      : await noticesTable().insert({ ...row, created_by: user?.email ?? '' } as never);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    toast.success(id ? 'Aviso atualizado' : 'Aviso publicado no kanban');
    setDraft(null); load();
  };

  const toggle = async (n: KanbanNotice) => {
    const { error } = await noticesTable().update({ enabled: !n.enabled, updated_at: new Date().toISOString() } as never).eq('id', n.id);
    if (error) { toast.error('Não foi possível alterar'); return; }
    load();
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await noticesTable().delete().eq('id', removing.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    toast.success('Aviso excluído');
    setRemoving(null); load();
  };

  const statusOf = (n: KanbanNotice) => {
    if (!n.enabled) return { label: 'Desligado', cls: 'text-muted-foreground' };
    if (n.starts_on && n.starts_on > today) return { label: `Começa ${shortDate(n.starts_on)}`, cls: 'text-warning' };
    if (n.ends_on && n.ends_on < today) return { label: 'Encerrado', cls: 'text-muted-foreground' };
    return { label: n.ends_on ? `No ar até ${shortDate(n.ends_on)}` : 'No ar', cls: 'text-success' };
  };

  const liveCount = list.filter((n) => isLive(n, today)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avisos do kanban"
        description="Escreva um aviso e ele aparece no topo do kanban de todo mundo. Cada pessoa pode fechar o aviso; se você editar, ele volta a aparecer."
        actions={<Button onClick={() => setDraft(emptyNotice())} disabled={state !== 'ready'}><Plus className="mr-2 h-4 w-4" />Novo aviso</Button>}
      />

      {state === 'loading' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {state === 'missing' && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          Falta aplicar a migração <code className="text-xs">20261103150000_kanban_notices</code> no Lovable.
        </p>
      )}

      {state === 'ready' && list.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">Nenhum aviso ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Ex.: "Sexta não tem expediente" ou "Novo padrão de legenda a partir de segunda".</p>
        </div>
      )}

      {state === 'ready' && list.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="flex items-center justify-between border-b px-4 py-3 text-sm font-semibold">
            Avisos
            <span className="text-xs font-medium text-muted-foreground">{liveCount} no ar agora</span>
          </h2>
          <ul className="divide-y">
            {list.map((n) => {
              const st = statusOf(n);
              return (
                <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Switch checked={n.enabled} onCheckedChange={() => toggle(n)} aria-label={n.enabled ? 'Desligar' : 'Ligar'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className={cn('font-medium', st.cls)}>{st.label}</span>
                      {' · '}{TONES.find((t) => t.value === n.tone)?.label}
                      {n.message ? ` · ${n.message}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setDraft({ ...n })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setRemoving(n)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{draft?.id ? 'Editar aviso' : 'Novo aviso'}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="notice-title">Título</Label>
                <Input id="notice-title" value={draft.title} maxLength={120} placeholder="Ex.: Sexta não tem expediente"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notice-message">Mensagem (opcional)</Label>
                <Textarea id="notice-message" rows={3} value={draft.message} placeholder="Detalhes do aviso"
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TONES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setDraft({ ...draft, tone: t.value })}
                      className={cn('rounded-lg border p-2.5 text-left transition-colors',
                        draft.tone === t.value ? 'border-primary bg-primary/10' : 'hover:border-foreground/30')}>
                      <p className="text-sm font-medium text-foreground">{t.label}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{t.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notice-link">Link (opcional)</Label>
                <Input id="notice-link" value={draft.link} placeholder="/planner ou https://..."
                  onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="notice-start">Aparece a partir de</Label>
                  <Input id="notice-start" type="date" value={draft.starts_on ?? ''} onChange={(e) => setDraft({ ...draft, starts_on: e.target.value || null })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notice-end">Some depois de</Label>
                  <Input id="notice-end" type="date" value={draft.ends_on ?? ''} onChange={(e) => setDraft({ ...draft, ends_on: e.target.value || null })} />
                </div>
              </div>
              <p className="-mt-2 text-[11px] text-muted-foreground">Sem datas, o aviso fica no ar até você desligar.</p>
              <div className="space-y-1.5">
                <Label>Prévia</Label>
                <KanbanNoticeBanner preview={[{
                  id: 'preview', created_by: '', updated_at: '', ...draft,
                  title: draft.title.trim() || 'Título do aviso',
                }]} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{draft?.id ? 'Salvar' : 'Publicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este aviso?</AlertDialogTitle>
            <AlertDialogDescription>"{removing?.title}" some do kanban de todo mundo. Para só tirar do ar, use o botão de ligar e desligar.</AlertDialogDescription>
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
