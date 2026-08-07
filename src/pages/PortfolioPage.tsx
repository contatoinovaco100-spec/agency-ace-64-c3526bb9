import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Trash2, Film, Copy, Pencil, GripVertical, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  client_id: string | null;
  video_url: string;
  thumbnail_url: string;
  category: string;
  completed_at: string | null;
  created_at: string;
  order_index: number;
}

const CATEGORIES = ['Institucional', 'Publicitário', 'Social Media', 'Documentário', 'Evento', 'Motion Graphics', 'Outro'];

const emptyForm = { title: '', description: '', client_id: '', video_url: '', thumbnail_url: '', category: '', completed_at: '' };

export default function PortfolioPage() {
  const { clients } = useAgency();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('all');
  const [form, setForm] = useState(emptyForm);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) {
        // Fallback to created_at if order_index doesn't exist yet
        const { data: fallbackData } = await supabase
          .from('portfolio_projects')
          .select('*')
          .order('created_at', { ascending: false });
        setProjects((fallbackData as any[]) || []);
      } else {
        setProjects((data as any[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel('portfolio-projects-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portfolio_projects' }, () => fetchProjects())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'portfolio_projects' }, () => fetchProjects())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: PortfolioProject) => {
    setEditingId(p.id);
    setForm({
      title: p.title || '',
      description: p.description || '',
      client_id: p.client_id || '',
      video_url: p.video_url || '',
      thumbnail_url: p.thumbnail_url || '',
      category: p.category || '',
      completed_at: p.completed_at ? p.completed_at.slice(0, 10) : '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Título é obrigatório'); return; }
    const payload = {
      title: form.title,
      description: form.description,
      client_id: form.client_id || null,
      video_url: form.video_url,
      thumbnail_url: form.thumbnail_url,
      category: form.category,
      completed_at: form.completed_at || null,
    };
    if (editingId) {
      await supabase.from('portfolio_projects').update(payload as any).eq('id', editingId);
      toast.success('Projeto atualizado');
    } else {
      const nextOrder = projects.length;
      await supabase.from('portfolio_projects').insert({ ...payload, order_index: nextOrder } as any);
      toast.success('Projeto adicionado ao portfólio');
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    fetchProjects();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('portfolio_projects').delete().eq('id', id);
    toast.success('Projeto removido');
    fetchProjects();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);

    const newProjects = arrayMove(projects, oldIndex, newIndex);
    setProjects(newProjects);

    // Update orders in background
    const updates = newProjects.map((p, i) => ({
      id: p.id,
      order_index: i,
    }));

    try {
      // We do it one by one or batch if supported
      for (const update of updates) {
        await supabase.from('portfolio_projects').update({ order_index: update.order_index } as any).eq('id', update.id);
      }
    } catch (err) {
      toast.error('Erro ao salvar nova ordem');
    }
  };

  const getVideoEmbed = (url: string) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  };

  const filtered = filterCat === 'all' ? projects : projects.filter(p => p.category === filterCat);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfólio</h1>
          <p className="text-sm text-muted-foreground">Galeria de projetos finalizados, atualiza em tempo real na LP</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/vitrine`;
              navigator.clipboard.writeText(url);
              toast.success('Link copiado!', { description: url });
            }}
          >
            <Copy className="mr-2 h-4 w-4" />Copiar link da LP
          </Button>
          <a href="/vitrine" target="_blank" rel="noreferrer">
            <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Ver LP</Button>
          </a>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Projeto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Editar Projeto' : 'Adicionar Projeto'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>URL do Vídeo (YouTube/Vimeo)</Label><Input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
                <div><Label>URL da Thumbnail</Label><Input value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
                <div><Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data de Conclusão</Label><Input type="date" value={form.completed_at} onChange={e => setForm({ ...form, completed_at: e.target.value })} /></div>
                <Button className="w-full" onClick={handleSave}>{editingId ? 'Salvar alterações' : 'Salvar'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configurações da Vitrine */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Links dos botões da Vitrine</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Link do botão principal (CTA / WhatsApp)</Label>
              <Input
                value={settings.cta_url}
                onChange={e => setSettings({ ...settings, cta_url: e.target.value })}
                placeholder="https://api.whatsapp.com/send/?phone=55..."
              />
            </div>
            <div>
              <Label>Link do Instagram</Label>
              <Input
                value={settings.instagram_url}
                onChange={e => setSettings({ ...settings, instagram_url: e.target.value })}
                placeholder="https://www.instagram.com/..."
              />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? 'Salvando...' : 'Salvar links'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Badge variant={filterCat === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilterCat('all')}>Todos</Badge>
        {CATEGORIES.map(c => (
          <Badge key={c} variant={filterCat === c ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilterCat(c)}>{c}</Badge>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Film className="h-12 w-12 mb-3 opacity-40" />
          <p>Nenhum projeto no portfólio ainda</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(p => (
                <SortableProjectCard 
                  key={p.id} 
                  p={p} 
                  clients={clients} 
                  openEdit={openEdit} 
                  handleDelete={handleDelete}
                  getVideoEmbed={getVideoEmbed}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableProjectCard({ 
  p, clients, openEdit, handleDelete, getVideoEmbed 
}: { 
  p: PortfolioProject; clients: any[]; openEdit: (p: PortfolioProject) => void; 
  handleDelete: (id: string) => void; getVideoEmbed: (url: string) => string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.6 : 1,
  };

  const embed = getVideoEmbed(p.video_url);
  const client = clients.find(c => c.id === p.client_id);

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden group relative">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-2 z-10 p-1.5 bg-black/60 text-white rounded-md cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {embed ? (
        <div className="aspect-video"><iframe src={embed} className="h-full w-full" allowFullScreen /></div>
      ) : p.thumbnail_url ? (
        <div className="aspect-video"><img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" /></div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center"><Film className="h-10 w-10 text-muted-foreground" /></div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{p.title}</h3>
            {client && <p className="text-xs text-muted-foreground truncate">{client.companyName}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {p.video_url && (
              <a href={p.video_url} target="_blank" rel="noreferrer" title="Abrir vídeo">
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              </a>
            )}
            <button onClick={() => openEdit(p)} title="Editar projeto" aria-label="Editar projeto">
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
            </button>
            <button onClick={() => handleDelete(p.id)} title="Excluir projeto" aria-label="Excluir projeto">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
            </button>
          </div>
        </div>
        {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
        <div className="flex gap-2">
          {p.category && <Badge variant="secondary">{p.category}</Badge>}
          {p.completed_at && <Badge variant="outline">{new Date(p.completed_at).toLocaleDateString('pt-BR')}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
