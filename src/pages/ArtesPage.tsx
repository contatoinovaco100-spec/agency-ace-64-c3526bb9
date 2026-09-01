import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgency } from '@/contexts/AgencyContext';
import { Task } from '@/types/agency';
import TasksPage from './TasksPage';
import { useToast } from '@/hooks/use-toast';

const PUBLIC_PANEL_URL = 'https://inovamarketing.online/painel-artes';

const ARTE_TEMPLATE_DESCRIPTION = `H1 (Headline):
[escreva aqui a headline principal da arte]

H2 (Texto corpo da arte):
[escreva aqui o texto de apoio / corpo]

CTA (Chamada para ação):
[escreva aqui a chamada para ação]`;

/**
 * Kanban exclusivo para entregas de Arte estática (designer).
 * Reutiliza toda a estrutura da página de Tarefas, mas filtra somente tarefas
 * cujo `taskType === 'Arte'`. Tarefas criadas aqui já nascem com esse tipo.
 */
export default function ArtesPage() {
  const { addTask } = useAgency();
  const { toast } = useToast();

  const createTemplateTask = async () => {
    const now = new Date();
    const newTask: Task = {
      id: crypto.randomUUID(),
      clientId: '',
      title: 'Nova Arte Estática (modelo)',
      description: ARTE_TEMPLATE_DESCRIPTION,
      assignee: '',
      priority: 'Média',
      dueDate: '',
      status: 'A fazer',
      taskType: 'Arte',
      videoName: '',
      platform: '',
      format: '',
      videoObjective: '',
      scriptWriter: '',
      editor: '',
      videoIdea: '',
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
      toast({
        title: 'Modelo criado',
        description: 'Tarefa de arte estática criada com H1, H2 e CTA. Edite para preencher.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao criar modelo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <TasksPage
      taskTypeFilter="Arte"
      groupedByDueDate
      pageTitle="Artes Estáticas"
      pageHint="Kanban exclusivo do designer — artes para feed, carrossel e estáticos"
      headerExtra={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={createTemplateTask}
            className="gap-1 flex-1 sm:flex-none"
            title="Cria uma tarefa-modelo com H1, H2 e CTA já estruturados"
          >
            <Sparkles className="h-3.5 w-3.5" /> Modelo Arte Estática
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1 flex-1 sm:flex-none border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <a href={PUBLIC_PANEL_URL} target="_blank" rel="noopener noreferrer" title="Abrir painel público do designer">
              <ExternalLink className="h-3.5 w-3.5" /> Painel do designer
            </a>
          </Button>
        </>
      }
    />
  );
}
