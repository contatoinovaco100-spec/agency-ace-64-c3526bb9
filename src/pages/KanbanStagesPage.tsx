import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useKanbanStages,
  KanbanBoard,
  KanbanStage,
  STAGE_COLORS,
  colorClasses,
} from '@/hooks/useKanbanStages';
import { Plus, Trash2, ArrowUp, ArrowDown, Check, X, Pencil, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const BOARDS: { value: KanbanBoard; label: string }[] = [
  { value: 'tasks', label: 'Tarefas' },
  { value: 'crm',   label: 'CRM' },
  { value: 'artes', label: 'Artes' },
  { value: 'pre',   label: 'Pré-Produção' },
];

function BoardEditor({ board }: { board: KanbanBoard }) {
  const { stages, loading, addStage, renameStage, updateStageColor, deleteStage, reorder } =
    useKanbanStages(board);
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('muted');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (stages.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Etapa já existe', variant: 'destructive' });
      return;
    }
    try {
      await addStage(name, newColor);
      setNewName('');
      setNewColor('muted');
      toast({ title: 'Etapa adicionada' });
    } catch (e: any) {
      toast({ title: 'Erro ao adicionar', description: e?.message, variant: 'destructive' });
    }
  };

  const handleRename = async (s: KanbanStage) => {
    const next = editingValue.trim();
    if (!next || next === s.name) { setEditingId(null); return; }
    if (stages.some(x => x.id !== s.id && x.name.toLowerCase() === next.toLowerCase())) {
      toast({ title: 'Já existe outra etapa com esse nome', variant: 'destructive' });
      return;
    }
    try {
      await renameStage(s.name, next);
      setEditingId(null);
      toast({ title: 'Etapa renomeada — os cards foram atualizados' });
    } catch (e: any) {
      toast({ title: 'Erro ao renomear', description: e?.message, variant: 'destructive' });
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    try {
      await reorder(next.map(s => s.id));
    } catch (e: any) {
      toast({ title: 'Erro ao reordenar', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (s: KanbanStage) => {
    if (s.is_system) {
      toast({ title: 'Etapa do sistema não pode ser excluída', variant: 'destructive' });
      return;
    }
    if (!confirm(`Excluir a etapa "${s.name}"? Cards nesta etapa precisarão ser movidos manualmente.`)) return;
    try {
      await deleteStage(s.id);
      toast({ title: 'Etapa excluída' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Input
          placeholder="Nome da nova etapa"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <Select value={newColor} onValueChange={setNewColor}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STAGE_COLORS.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-3 w-3 rounded-full', c.swatch)} />
                  {c.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {stages.map((s, idx) => {
          const cc = colorClasses(s.color);
          const isEditing = editingId === s.id;
          return (
            <div
              key={s.id}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2',
                cc.bg,
              )}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full', cc.dot)} />
              {isEditing ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input
                    autoFocus
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(s); if (e.key === 'Escape') setEditingId(null); }}
                    className="h-8 text-sm"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRename(s)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                  {s.is_system && (
                    <span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Etapa do sistema — usada por regras de negócio">
                      <Lock className="h-3 w-3" /> sistema
                    </span>
                  )}
                  <Select value={s.color} onValueChange={v => updateStageColor(s.id, v)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGE_COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-3 w-3 rounded-full', c.swatch)} />
                            {c.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={idx === 0} onClick={() => handleMove(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={idx === stages.length - 1} onClick={() => handleMove(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => { setEditingId(s.id); setEditingValue(s.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                    disabled={s.is_system}
                    onClick={() => handleDelete(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KanbanStagesPage() {
  const { isAdmin, loading } = useUserRole();

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Apenas administradores podem editar as etapas dos kanbans.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Etapas do Kanban</h1>
        <p className="text-sm text-muted-foreground">
          Renomeie, adicione, remova e reordene as colunas dos kanbans. Ao renomear, os cards existentes são movidos automaticamente.
        </p>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          {BOARDS.map(b => (
            <TabsTrigger key={b.value} value={b.value}>{b.label}</TabsTrigger>
          ))}
        </TabsList>
        {BOARDS.map(b => (
          <TabsContent key={b.value} value={b.value} className="mt-4">
            <BoardEditor board={b.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
