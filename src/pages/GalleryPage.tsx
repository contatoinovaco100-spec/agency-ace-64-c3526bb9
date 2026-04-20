import { useState, useEffect, useMemo } from 'react';
import { Images, Play, Upload, Search, Filter, Film, Image as ImageIcon, ExternalLink, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAgency } from '@/contexts/AgencyContext';
import { supabase } from '@/integrations/supabase/client';
import { TaskAttachment } from '@/types/agency';

interface MediaItem { 
  id: string; 
  taskId: string;
  title: string; 
  type: 'video' | 'image'; 
  url: string;
  thumbnail: string; 
  client: string; 
  date: string; 
  tag: string; 
}

const TAG_COLORS: Record<string, string> = {
  institucional: 'bg-blue-500/20 text-blue-400',
  reels: 'bg-pink-500/20 text-pink-400',
  story: 'bg-purple-500/20 text-purple-400',
  stories: 'bg-purple-500/20 text-purple-400',
  shorts: 'bg-red-500/20 text-red-400',
  feed: 'bg-blue-500/20 text-blue-400',
  longo: 'bg-orange-500/20 text-orange-400',
};

const GRAD_COLORS = [
  'from-blue-900 to-blue-700',
  'from-purple-900 to-purple-700',
  'from-green-900 to-green-700',
  'from-yellow-900 to-yellow-700',
  'from-pink-900 to-pink-700',
  'from-indigo-900 to-indigo-700',
];

export default function GalleryPage() {
  const { tasks, clients, loading: contextLoading } = useAgency();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllAttachments() {
      try {
        const { data, error } = await supabase
          .from('task_attachments')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          setAttachments(data.map(r => ({
            id: r.id,
            taskId: r.task_id,
            fileName: r.file_name,
            fileUrl: r.file_url,
            fileType: r.file_type,
            createdAt: r.created_at
          })));
        }
      } catch (err) {
        console.error('Error fetching attachments:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllAttachments();
  }, []);

  const mediaItems = useMemo(() => {
    // Filter finalized tasks
    const finalizedTasks = tasks.filter(t => t.status === 'Finalizado');
    
    const items: MediaItem[] = [];
    
    finalizedTasks.forEach(task => {
      const taskAttachments = attachments.filter(a => a.taskId === task.id);
      const clientName = clients.find(c => c.id === task.clientId)?.companyName || 'Sem cliente';
      const tag = (task.format || task.taskType || 'Geral').toLowerCase();
      const dateStr = new Date(task.dueDate || '').toLocaleDateString('pt-BR');
      const seenUrls = new Set<string>();

      // 1) video_url direto na tarefa (ex: link do Google Drive)
      const taskVideoUrl = (task as any).videoUrl || (task as any).video_url;
      if (taskVideoUrl && typeof taskVideoUrl === 'string' && taskVideoUrl.trim()) {
        seenUrls.add(taskVideoUrl);
        items.push({
          id: `task-${task.id}`,
          taskId: task.id,
          title: task.videoName || task.title,
          type: 'video',
          url: taskVideoUrl,
          thumbnail: '',
          client: clientName,
          date: dateStr,
          tag
        });
      }

      // 2) Anexos da tarefa
      taskAttachments.forEach(att => {
        if (seenUrls.has(att.fileUrl)) return;
        const url = att.fileUrl || '';
        const isVideo = att.fileType.includes('video') ||
          (att.fileType === 'link' && (
            url.includes('youtube') ||
            url.includes('vimeo') ||
            url.includes('drive.google') ||
            url.includes('.mp4') ||
            url.includes('.mov')
          ));
        const isImage = att.fileType.includes('image');

        if (isVideo || isImage) {
          seenUrls.add(url);
          items.push({
            id: att.id,
            taskId: task.id,
            title: task.videoName || task.title || att.fileName,
            type: isVideo ? 'video' : 'image',
            url,
            thumbnail: '',
            client: clientName,
            date: new Date(att.createdAt || task.dueDate || '').toLocaleDateString('pt-BR'),
            tag
          });
        }
      });
    });
    
    return items;
  }, [tasks, attachments, clients]);

  const filtered = mediaItems.filter(m =>
    (type === 'all' || m.type === type) &&
    (m.title.toLowerCase().includes(search.toLowerCase()) || m.client.toLowerCase().includes(search.toLowerCase()))
  );

  const isVideoUrl = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('youtube.com') || url.includes('vimeo.com');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Images className="h-6 w-6 text-primary" /> Galeria de Entregas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mediaItems.length} arquivos de mídia finalizados nas tarefas
          </p>
        </div>
        <Button className="flex items-center gap-2" variant="outline" onClick={() => window.open('/tarefas', '_self')}>
          Ir para Tarefas
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por título ou cliente..." 
            className="pl-9" 
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="video">Vídeos</SelectItem>
            <SelectItem value="image">Imagens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(loading || contextLoading) ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground mt-4">Carregando galeria...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item, idx) => (
            <div 
              key={item.id} 
              onClick={() => setSelected(item)}
              className="group rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col h-full bg-card"
            >
              <div className={cn(
                'aspect-video bg-gradient-to-br flex items-center justify-center relative overflow-hidden', 
                GRAD_COLORS[idx % GRAD_COLORS.length]
              )}>
                {item.type === 'video' ? (
                  <Film className="h-12 w-12 text-white/30" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-white/30" />
                )}
                
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Play className="h-5 w-5 text-white fill-current" />
                    </div>
                  </div>
                )}
                
                {item.type === 'image' && item.url && (
                  <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground truncate" title={item.title}>{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.client}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4 capitalize', TAG_COLORS[item.tag] || 'bg-muted text-muted-foreground')}>
                    {item.tag}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{item.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !contextLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Images className="h-12 w-12 mb-3 opacity-20" />
          <p>Nenhuma entrega encontrada.</p>
        </div>
      )}

      {/* Preview Modal */}
      {selected && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" 
          onClick={() => setSelected(null)}
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video bg-black flex items-center justify-center border-b border-border">
              {selected.type === 'video' ? (
                selected.url.includes('youtube.com') || selected.url.includes('youtu.be') ? (
                  <iframe 
                    className="w-full h-full"
                    src={selected.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                    title={selected.title}
                    allowFullScreen
                  />
                ) : selected.url.includes('drive.google') ? (
                    <iframe 
                      className="w-full h-full"
                      src={selected.url.replace('/view', '/preview')}
                      allow="autoplay"
                    />
                ) : (
                  <video 
                    src={selected.url} 
                    controls 
                    className="max-h-full max-w-full"
                    autoPlay
                  />
                )
              ) : (
                <img src={selected.url} alt={selected.title} className="max-h-full max-w-full object-contain" />
              )}
              
              <button 
                className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur-md transition-colors"
                onClick={() => setSelected(null)}
              >
                <ImageIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className={cn('mb-2', TAG_COLORS[selected.tag] || 'bg-muted text-muted-foreground')}>
                    {selected.tag}
                  </Badge>
                  <h3 className="font-semibold text-foreground text-xl">{selected.title}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {selected.client}
                    </p>
                    <p className="text-muted-foreground text-sm">{selected.date}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(selected.url, '_blank')}>
                    <ExternalLink className="h-4 w-4" /> Abrir Original
                  </Button>
                  {selected.type === 'video' && !selected.url.includes('youtube') && !selected.url.includes('google') && (
                    <Button size="sm" className="gap-2" asChild>
                      <a href={selected.url} download={selected.title}>
                        <Download className="h-4 w-4" /> Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
