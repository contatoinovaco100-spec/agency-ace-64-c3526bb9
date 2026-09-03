import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Film, Palette, Calendar, Check, Trash2, Plus, Loader2,
  GripVertical, Pencil, Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAgency } from '@/contexts/AgencyContext';
import type { PlanningItem, PlanningItemType } from '@/lib/pdfPlanningParser';
import type { Task, TaskType } from '@/types/agency';

interface PdfPlanningCardsProps {
  items: PlanningItem[];
  onChange: (items: PlanningItem[]) => void;
  clientId: string;
}

export function PdfPlanningCards({ items, onChange, clientId }: PdfPlanningCardsProps) {
  const { addTask, clients } = useAgency();
  const clientName = clients.find(c => c.id === clientId)?.companyName || '';
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const videos = items.filter(i => i.type === 'video');
  const arts = items.filter(i => i.type === 'arte');

  const updateItem = (id: string, updates: Partial<PlanningItem>) => {
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
  };

  const addNewItem = (type: PlanningItemType) => {
    const newItem: PlanningItem = {
      id: crypto.randomUUID(),
      title: '',
      date: '',
      type,
      description: '',
      rawText: '',
    };
    onChange([...items, newItem]);
    setEditingId(newItem.id);
  };

  const createAsTask = async (item: PlanningItem) => {
    if (!item.title.trim()) {
      toast.error('Preencha o título antes de criar o card.');
      return;
    }

    setCreatingId(item.id);

    const taskType: TaskType = item.type === 'video' ? 'Produção de Vídeo' : 'Arte';
    const newTask: Task = {
      id: crypto.randomUUID(),
      clientId,
      title: item.title,
      description: item.description || `Importado do planejamento em PDF`,
      assignee: '',
      priority: 'Média',
      dueDate: item.date || '',
      status: 'A fazer',
      taskType,
      videoName: item.title,
      platform: '',
      format: '',
      videoObjective: '',
      scriptWriter: '',
      editor: '',
      videoIdea: item.description || item.title,
      fullScript: '',
      videoReferences: '',
      observations: '',
      creativeDirection: '',
      editingStyle: '',
      strategicNotes: '',
      recordingNotes: '',
      editorComments: '',
      currentStageOwner: '',
      copywriter: '',
      director: '',
      videomaker: '',
    };

    try {
      await addTask(newTask);
      toast.success(`Card "${item.title}" criado no Kanban!`);
      onChange(items.filter(i => i.id !== item.id));
    } catch (err: any) {
      toast.error(`Erro ao criar card: ${err.message}`);
    } finally {
      setCreatingId(null);
    }
  };

  const createAllAsTasks = async (type: PlanningItemType) => {
    const filtered = type === 'video' ? videos : arts;
    if (filtered.length === 0) {
      toast.error(`Nenhum ${type === 'video' ? 'vídeo' : 'arte'} para importar.`);
      return;
    }

    for (const item of filtered) {
      if (item.title.trim()) {
        await createAsTask(item);
      }
    }
  };

  const renderCard = (item: PlanningItem, index: number) => {
    const isEditing = editingId === item.id;
    const isCreating = creatingId === item.id;
    const isVideo = item.type === 'video';

    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ delay: index * 0.05 }}
        className={`
          border rounded-xl overflow-hidden transition-all
          ${isVideo
            ? 'border-blue-500/20 bg-blue-500/5'
            : 'border-purple-500/20 bg-purple-500/5'
          }
        `}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <GripVertical className="w-4 h-4 text-zinc-600 shrink-0" />
              {isEditing ? (
                <Input
                  value={item.title}
                  onChange={e => updateItem(item.id, { title: e.target.value })}
                  placeholder="Título do conteúdo"
                  className="bg-black/60 border-white/10 font-semibold"
                  autoFocus
                />
              ) : (
                <h4 className="font-semibold text-white truncate">
                  {item.title || 'Sem título'}
                </h4>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Badge
                variant="outline"
                className={`text-xs ${
                  isVideo
                    ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                    : 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                }`}
              >
                {isVideo ? <Film className="w-3 h-3 mr-1" /> : <Palette className="w-3 h-3 mr-1" />}
                {isVideo ? 'Vídeo' : 'Arte'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                type="date"
                value={item.date}
                onChange={e => updateItem(item.id, { date: e.target.value })}
                className="bg-black/60 border-white/10 w-auto"
              />
            ) : item.date ? (
              <span className="text-sm text-zinc-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            ) : (
              <span className="text-sm text-zinc-600">Sem data</span>
            )}
          </div>

          {isEditing ? (
            <Textarea
              value={item.description}
              onChange={e => updateItem(item.id, { description: e.target.value })}
              placeholder="Descrição ou observações..."
              className="bg-black/60 border-white/10 min-h-[60px] text-sm"
            />
          ) : item.description ? (
            <p className="text-sm text-zinc-400 line-clamp-2">{item.description}</p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(item.id)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(item.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  onClick={() => createAsTask(item)}
                  disabled={isCreating || !item.title.trim()}
                  className={`font-semibold ${
                    isVideo
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {isCreating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Criar no Kanban
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSection = (title: string, icon: React.ReactNode, sectionItems: PlanningItem[], type: PlanningItemType, color: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <Badge variant="outline" className="text-xs border-white/10 text-zinc-400">
            {sectionItems.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => addNewItem(type)}
            className="border-white/10 text-zinc-400 hover:text-white"
          >
            <Plus className="w-3 h-3 mr-1" />
            Adicionar
          </Button>
          {sectionItems.length > 0 && (
            <Button
              size="sm"
              onClick={() => createAllAsTasks(type)}
              className={`font-semibold ${color}`}
            >
              <Check className="w-3 h-3 mr-1" />
              Importar Todos
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sectionItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 border border-dashed border-white/10 rounded-xl"
          >
            <p className="text-zinc-500 text-sm">Nenhum {type === 'video' ? 'vídeo' : 'arte'} encontrado no PDF.</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => addNewItem(type)}
              className="mt-2 text-primary hover:bg-primary/10"
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar manualmente
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sectionItems.map((item, i) => renderCard(item, i))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-8">
      {renderSection(
        'Vídeos',
        <Film className="w-5 h-5 text-blue-400" />,
        videos,
        'video',
        'bg-blue-500 hover:bg-blue-600 text-white'
      )}

      <div className="border-t border-white/5" />

      {renderSection(
        'Artes',
        <Palette className="w-5 h-5 text-purple-400" />,
        arts,
        'arte',
        'bg-purple-500 hover:bg-purple-600 text-white'
      )}
    </div>
  );
}
