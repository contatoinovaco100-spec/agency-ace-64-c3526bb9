import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TasksPage from './TasksPage';

const PUBLIC_PANEL_URL = 'https://inovamarketing.online/painel-artes';

/**
 * Kanban exclusivo para entregas de Arte estática (designer).
 * Reutiliza toda a estrutura da página de Tarefas, mas filtra somente tarefas
 * cujo `taskType === 'Arte'`. Tarefas criadas aqui já nascem com esse tipo.
 */
export default function ArtesPage() {
  return (
    <TasksPage
      taskTypeFilter="Arte"
      pageTitle="Artes Estáticas"
      pageHint="Kanban exclusivo do designer — artes para feed, carrossel e estáticos"
      headerExtra={
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
      }
    />
  );
}
