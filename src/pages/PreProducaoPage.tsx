import { useMemo, useState } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { useKanbanStages, colorClasses } from '@/hooks/useKanbanStages';
import { Task } from '@/types/agency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Film, FolderOpen, Scissors, ExternalLink, Save, Archive, CheckCircle2 } from 'lucide-react';
import { todaySP, groupTasksByDate, DateGroup } from '@/lib/kanbanDateGroups';
import { cn } from '@/lib/utils';

const ALL = '__all__';
const NONE = '__none__';

export default function PreProducaoPage() {
  const { tasks, clients, team, updateTask } = useAgency();
  const { stages } = useKanbanStages('pre');

  const [selected, setSelected] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  const [filterClient, setFilterClient] = useState(ALL);
  const [filterDecupador, setFilterDecupador] = useState(ALL);
  const [filterEditor, setFilterEditor] = useState(ALL);
  const [search, setSearch] = useState('');

  const stageNames = useMemo(() => stages.map(s => s.name), [stages]);
  const firstStage = stageNames[0] || 'Material Bruto Recebido';

  // Etapas "do sistema" (Finalizado/Concluído) = arquivo/concluído: o vídeo
  // sai do board de produção e vai para o histórico. As demais são as colunas.
  const doneStages = useMemo(() => stages.filter(s => s.is_system), [stages]);
  const doneStageNames = useMemo(() => doneStages.map(s => s.name), [doneStages]);
  const activeStages = useMemo(() => stages.filter(s => !s.is_system), [stages]);
  const activeStageNames = useMemo(() => activeStages.map(s => s.name), [activeStages]);

  const clientName = (id?: string) => clients.find(c => c.id === id)?.companyName || '—';

  /** Cards do board: vídeos que entraram no fluxo de pré-produção — ou
   *  estão numa etapa ativa do kanban (preStage) ou têm material bruto
   *  (rawFootageUrl, ficam na coluna inicial "Material Bruto Recebido").
   *  Finalizados somem daqui e vão para o arquivo. */
  const boardTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.deletedAt) return false;
      if (t.taskType === 'Arte') return false;
      if (doneStageNames.includes(t.preStage || '')) return false;
      const inActiveStage = !!t.preStage && activeStageNames.includes(t.preStage);
      const hasMaterial = !!t.rawFootageUrl && String(t.rawFootageUrl).trim().length > 0;
      if (!inActiveStage && !hasMaterial) return false;
      if (filterClient !== ALL && t.clientId !== filterClient) return false;
      if (filterDecupador !== ALL && (t.decupador || '') !== filterDecupador) return false;
      if (filterEditor !== ALL && (t.editor || '') !== filterEditor) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${t.title} ${t.videoName || ''} ${clientName(t.clientId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filterClient, filterDecupador, filterEditor, search, clients, doneStageNames, activeStageNames]);

  /** Cards concluídos (arquivo). Só aparecem quando o filtro "Mostrar finalizados" está ligado. */
  const doneTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.deletedAt) return false;
      if (t.taskType === 'Arte') return false;
      if (!t.preStage || !doneStageNames.includes(t.preStage)) return false;
      if (filterClient !== ALL && t.clientId !== filterClient) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${t.title} ${t.videoName || ''} ${clientName(t.clientId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filterClient, search, clients, doneStageNames]);

  const today = todaySP();

  const taskDate = (t: Task) => t.dueDate || t.postDate;

  const sortByTimeAndClient = (a: Task, b: Task) => {
    const aDate = taskDate(a);
    const bDate = taskDate(b);
    const aTime = a.postTime && a.postDate === aDate ? a.postTime : '';
    const bTime = b.postTime && b.postDate === bDate ? b.postTime : '';
    if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
    const aClient = clientName(a.clientId);
    const bClient = clientName(b.clientId);
    if (aClient !== bClient) return aClient.localeCompare(bClient);
    return a.title.localeCompare(b.title);
  };

  const byStageGroups = useMemo(() => {
    const tasksByStage: Record<string, Task[]> = {};
    activeStages.forEach(n => { tasksByStage[typeof n === "string" ? n : n.name] = []; });
    boardTasks.forEach(t => {
      const stage = t.preStage && activeStages.some(s => s.name === t.preStage) ? t.preStage : firstStage;
      (tasksByStage[stage] ||= []).push(t);
    });
    const groupsByStage: Record<string, DateGroup<Task>[]> = {};
    Object.keys(tasksByStage).forEach(stage => {
      groupsByStage[stage] = groupTasksByDate(tasksByStage[stage], taskDate, today, sortByTimeAndClient);
    });
    return groupsByStage;
  }, [boardTasks, activeStages, firstStage, today]);

  const summary = useMemo(
    () => activeStageNames.map(n => ({ name: n, count: boardTasks.filter(t => {
      const stage = t.preStage && activeStageNames.includes(t.preStage) ? t.preStage : firstStage;
      return stage === n;
    }).length })),
    [activeStageNames, boardTasks, firstStage],
  );

  const doneCount = useMemo(() => doneTasks.length, [doneTasks]);

  /** Ao finalizar a decupagem (etapa de sistema), o card do kanban principal
   *  segue para "Em edição" e some do board de pré-produção. */
  const withMainStatus = (task: Task, stage: string): Task => {
    if (doneStageNames.includes(stage) && task.status !== 'Em edição') {
      return { ...task, preStage: stage, status: 'Em edição' };
    }
    return { ...task, preStage: stage };
  };

  const moveTo = async (task: Task, stage: string) => {
    if ((task.preStage || firstStage) === stage) return;
    try {
      await updateTask(withMainStatus(task, stage));
      toast.success(
        doneStageNames.includes(stage)
          ? 'Decupagem finalizada — card enviado para Em edição no kanban'
          : `Movido para ${stage}`,
      );
    } catch {
      toast.error('Não foi possível mover o card.');
    }
  };

  const openCard = (t: Task) => {
    setSelected(t);
    setForm({ ...t, preStage: t.preStage || firstStage });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const merged = { ...selected, ...form } as Task;
      await updateTask(withMainStatus(merged, merged.preStage || firstStage));
      toast.success('Card atualizado');
      setSelected(null);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }

  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scissors className="h-6 w-6 text-primary" /> Pré-Produção
        </h1>
        <p className="text-sm text-muted-foreground">
          Decupagem do material bruto e entrega dos cortes para os editores.
        </p>
      </div>

      {/* Sumário */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {summary.map(s => (
          <Card key={s.name} className="p-3">
            <p className="text-xs text-muted-foreground truncate">{s.name}</p>
            <p className="text-2xl font-bold">{s.count}</p>
          </Card>
        ))}
        <Card
          className={cn('p-3 cursor-pointer transition-colors', showFinished && 'border-success/40 bg-success/5')}
          onClick={() => setShowFinished(v => !v)}
          title="Clique para mostrar/ocultar os vídeos finalizados"
        >
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Concluídos
          </p>
          <p className="text-2xl font-bold">{doneCount}</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por título ou cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDecupador} onValueChange={setFilterDecupador}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Decupador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os decupadores</SelectItem>
            {team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEditor} onValueChange={setFilterEditor}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Editor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os editores</SelectItem>
            {team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={showFinished ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFinished(v => !v)}
          className="gap-2"
        >
          <Archive className="h-4 w-4" />
          {showFinished ? 'Ocultar finalizados' : 'Ver finalizados'}
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {activeStages.map(stage => {
          const cls = colorClasses(stage.color);
          const groups = byStageGroups[stage.name] || [];
          const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);
          return (
            <div
              key={stage.id}
              className="min-w-[280px] w-[280px] shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                const t = boardTasks.find(x => x.id === dragId);
                if (t) moveTo(t, stage.name);
                setDragId(null);
              }}
            >
              <div className={`rounded-t-lg border px-3 py-2 flex items-center justify-between ${cls.bg}`}>
                <span className="text-sm font-semibold flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cls.dot}`} />
                  {stage.name}
                </span>
                <Badge variant="secondary">{total}</Badge>
              </div>
              <div className="border border-t-0 rounded-b-lg p-2 space-y-3 min-h-[220px] bg-card/40">
                {groups.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem cards</p>
                )}
                {groups.map(group => (
                  <div key={group.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {group.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{group.subtitle}</span>
                    </div>
                    <div className="space-y-2">
                      {group.tasks.map(t => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onClick={() => openCard(t)}
                          className={`cursor-pointer rounded-md border border-l-4 ${cls.border} bg-card px-2.5 py-2 hover:bg-accent/40 transition-colors`}
                        >
                          <p className="text-sm font-medium leading-tight line-clamp-1">{t.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            <span className="truncate">{clientName(t.clientId)}</span>
                            {(t.postTime || t.dueDate) && (
                              <span className="ml-auto shrink-0 tabular-nums">
                                {t.postTime ? t.postTime.slice(0, 5) : t.dueDate ? t.dueDate.slice(5) : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            {t.rawFootageUrl && <span title="Material bruto"><FolderOpen className="h-3 w-3 text-warning" /></span>}
                            {t.cutsUrl && <span title="Cortes prontos"><Scissors className="h-3 w-3 text-info" /></span>}
                            {t.videoUrl && <span title="Vídeo final"><Film className="h-3 w-3 text-success" /></span>}
                            {t.decupador && (
                              <span className="truncate rounded bg-muted/60 px-1.5 py-0.5 text-[10px]">
                                {t.decupador}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Arquivo de finalizados — só aparece quando o filtro está ligado */}
        {showFinished && (
          <div
            className="min-w-[280px] w-[280px] shrink-0"
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              const t = doneTasks.find(x => x.id === dragId);
              if (t) moveTo(t, doneStageNames[0] || 'Finalizado');
              setDragId(null);
            }}
          >
            <div className="rounded-t-lg border border-success/30 bg-success/10 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Archive className="h-4 w-4 text-success" />
                Finalizados
              </span>
              <Badge variant="secondary">{doneCount}</Badge>
            </div>
            <div className="border border-t-0 rounded-b-lg p-2 space-y-3 min-h-[220px] bg-card/40">
              {doneTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Sem vídeos finalizados</p>
              )}
              {groupTasksByDate(doneTasks, taskDate, today, sortByTimeAndClient).map(group => (
                <div key={group.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{group.subtitle}</span>
                  </div>
                  <div className="space-y-2">
                    {group.tasks.map(t => {
                      const doneStage = stageNames.find(n => n === t.preStage) || 'Finalizado';
                      const dd = colorClasses('success');
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onClick={() => openCard(t)}
                          className={`cursor-pointer rounded-md border border-l-4 ${dd.border} bg-card px-2.5 py-2 hover:bg-accent/40 transition-colors`}
                        >
                          <p className="text-sm font-medium leading-tight line-clamp-1">{t.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            <span className="truncate">{clientName(t.clientId)}</span>
                            <span className="ml-auto shrink-0 tabular-nums">
                              {t.postTime ? t.postTime.slice(0, 5) : t.dueDate ? t.dueDate.slice(5) : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            {t.cutsUrl && <span title="Cortes prontos"><Scissors className="h-3 w-3 text-info" /></span>}
                            {t.videoUrl && <span title="Vídeo final"><Film className="h-3 w-3 text-success" /></span>}
                            <span className="truncate rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                              {doneStage}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Painel do card */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">{clientName(selected.clientId)}</p>

              {/* Material bruto */}
              <div className="space-y-1.5">
                <Label>Pasta do Drive (material bruto)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.rawFootageUrl || ''}
                    onChange={e => setForm(f => ({ ...f, rawFootageUrl: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                  />
                  {form.rawFootageUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={form.rawFootageUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Referências */}
              <div className="space-y-1.5">
                <Label>Referências</Label>
                <Textarea
                  value={form.videoReferences || ''}
                  onChange={e => setForm(f => ({ ...f, videoReferences: e.target.value }))}
                  className="min-h-[100px]"
                  placeholder="Links e referências do vídeo"
                />
              </div>

              {/* Roteiro */}
              <div className="space-y-1.5">
                <Label>Roteiro</Label>
                <Textarea
                  value={form.fullScript || ''}
                  onChange={e => setForm(f => ({ ...f, fullScript: e.target.value }))}
                  className="min-h-[320px] max-h-[70vh] text-sm leading-relaxed"
                  placeholder="Roteiro completo do vídeo"
                />
              </div>

              {/* Decupagem */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Decupagem
                </p>
                <div className="space-y-1.5">
                  <Label>Marcações / melhores trechos</Label>
                  <Textarea
                    value={form.decupagemNotes || ''}
                    onChange={e => setForm(f => ({ ...f, decupagemNotes: e.target.value }))}
                    className="min-h-[120px]"
                    placeholder="00:12 - fala principal&#10;01:45 - b-roll da loja"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Link dos cortes prontos</Label>
                  <Input
                    value={form.cutsUrl || ''}
                    onChange={e => setForm(f => ({ ...f, cutsUrl: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>

              {/* Responsáveis + etapa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Decupador</Label>
                  <Select
                    value={form.decupador || NONE}
                    onValueChange={v => setForm(f => ({ ...f, decupador: v === NONE ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem responsável</SelectItem>
                      {team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Editor</Label>
                  <Select
                    value={form.editor || NONE}
                    onValueChange={v => setForm(f => ({ ...f, editor: v === NONE ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem responsável</SelectItem>
                      {team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select
                  value={form.preStage || firstStage}
                  onValueChange={v => setForm(f => ({ ...f, preStage: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={save} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
