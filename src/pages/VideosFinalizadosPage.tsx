import { useMemo, useState } from 'react';
import { ExternalLink, Video, CheckCircle2, Calendar, User, Search, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAgency } from '@/contexts/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/types/agency';

/**
 * Página para Social Media — lista vídeos que o editor já finalizou
 * (status === 'Finalizado' + videoUrl preenchido) e ainda não foram postados.
 * Ao clicar em "Marcar como Postado", o card some.
 */
export default function VideosFinalizadosPage() {
  const { tasks, clients, moveTaskToStage } = useAgency();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [posting, setPosting] = useState<string | null>(null);

  const videos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter(
        (t) =>
          t.taskType === 'Produção de Vídeo' &&
          t.status === 'Finalizado' &&
          !!t.videoUrl?.trim(),
      )
      .filter((t) => {
        if (!q) return true;
        const client = clients.find((c) => c.id === t.clientId)?.companyName || '';
        return (
          t.title.toLowerCase().includes(q) ||
          (t.videoName || '').toLowerCase().includes(q) ||
          client.toLowerCase().includes(q)
        );
      });
  }, [tasks, clients, search]);

  const markPosted = async (task: Task) => {
    setPosting(task.id);
    try {
      await moveTaskToStage(task.id, 'Concluído');
      toast({ title: 'Marcado como postado', description: task.title });
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível atualizar.',
        variant: 'destructive',
      });
    } finally {
      setPosting(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiado' });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" /> Vídeos Finalizados
          </h1>
          <p className="text-sm text-muted-foreground">
            Vídeos prontos para postar — assim que você marcar como postado, o card some daqui.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {videos.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Video className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum vídeo finalizado aguardando postagem.</p>
          <p className="text-xs mt-1">
            Tarefas de vídeo aparecem aqui quando o editor define o status como
            <span className="font-mono mx-1 px-1 rounded bg-muted">Finalizado</span>
            e adiciona o link do vídeo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((task) => {
            const client = clients.find((c) => c.id === task.clientId);
            return (
              <Card
                key={task.id}
                className="p-4 border-l-4 border-l-primary flex flex-col gap-3 hover:shadow-lg transition-shadow"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{task.title}</h3>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Finalizado
                    </Badge>
                  </div>
                  {task.videoName && (
                    <p className="text-xs text-muted-foreground truncate">{task.videoName}</p>
                  )}
                </div>

                <div className="text-xs space-y-1 text-muted-foreground">
                  {client && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" /> {client.companyName}
                    </div>
                  )}
                  {task.platform && (
                    <div>
                      <span className="font-medium">Plataforma:</span> {task.platform}
                      {task.format ? ` · ${task.format}` : ''}
                    </div>
                  )}
                  {(task.postDate || task.dueDate) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {task.postDate || task.dueDate}
                      {task.postTime ? ` às ${task.postTime}` : ''}
                    </div>
                  )}
                  {task.editor && (
                    <div>
                      <span className="font-medium">Editor:</span> {task.editor}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex gap-1">
                    <Button asChild size="sm" variant="outline" className="flex-1 gap-1">
                      <a href={task.videoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir vídeo
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyLink(task.videoUrl || '')}
                      title="Copiar link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => markPosted(task)}
                    disabled={posting === task.id}
                    className="gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {posting === task.id ? 'Salvando...' : 'Marcar como Postado'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
