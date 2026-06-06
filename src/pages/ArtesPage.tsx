import TasksPage from './TasksPage';

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
    />
  );
}
