import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Edit, Trash2, Tag, Target, Video, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ContentIdea {
  id: string;
  client_id: string;
  title: string;
  content_type: string | null;
  pillar: string | null;
  objective: string | null;
  status: string | null;
  scheduled_date: string | null;
}

const CONTENT_TYPES = ['Reel', 'TikTok', 'Story', 'Foto', 'Carrossel', 'YouTube'];
const STATUS_OPTIONS = ['Ideia', 'Aprovado', 'Gravado', 'Em edição', 'Postado'];

export function ContentIdeasTab({ clientId }: { clientId: string }) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [clientPillars, setClientPillars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Partial<ContentIdea> | null>(null);

  useEffect(() => {
    loadData();
  }, [clientId]);

  async function loadData() {
    if (!clientId) return;
    setLoading(true);
    try {
      // Fetch ideas
      const { data: ideasData, error: ideasError } = await supabase
        .from('content_ideas')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (ideasError) throw ideasError;
      setIdeas(ideasData || []);

      // Fetch pillars from editorial line
      const { data: editorialData } = await supabase
        .from('content_editorial_lines')
        .select('pillars')
        .eq('client_id', clientId)
        .maybeSingle();
        
      if (editorialData && editorialData.pillars) {
        setClientPillars(editorialData.pillars);
      } else {
        setClientPillars([]);
      }
    } catch (error) {
      console.error('Error loading ideas:', error);
      toast.error('Erro ao carregar as ideias de conteúdo');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNewDialog = () => {
    setEditingIdea({
      client_id: clientId,
      title: '',
      content_type: 'Reel',
      pillar: clientPillars.length > 0 ? clientPillars[0] : '',
      objective: '',
      status: 'Ideia'
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (idea: ContentIdea) => {
    setEditingIdea({ ...idea });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja apagar esta ideia?')) return;
    try {
      const { error } = await supabase.from('content_ideas').delete().eq('id', id);
      if (error) throw error;
      setIdeas(ideas.filter(i => i.id !== id));
      toast.success('Ideia excluída com sucesso!');
    } catch (err) {
      console.error('Error deleting idea:', err);
      toast.error('Erro ao excluir ideia');
    }
  };

  const handleSaveIdea = async () => {
    if (!editingIdea?.title?.trim()) {
      toast.error('O título da ideia é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        title: editingIdea.title,
        content_type: editingIdea.content_type,
        pillar: editingIdea.pillar,
        objective: editingIdea.objective,
        status: editingIdea.status || 'Ideia',
        // scheduled_date is preserved if updating
      };

      if (editingIdea.id) {
        // Update
        const { error } = await supabase
          .from('content_ideas')
          .update(payload)
          .eq('id', editingIdea.id);
        if (error) throw error;
        
        setIdeas(ideas.map(i => i.id === editingIdea.id ? { ...i, ...payload } as ContentIdea : i));
        toast.success('Ideia atualizada com sucesso!');
      } else {
        // Insert
        const { data, error } = await supabase
          .from('content_ideas')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        
        setIdeas([data as ContentIdea, ...ideas]);
        toast.success('Nova ideia criada com sucesso!');
      }
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Error saving idea:', err);
      toast.error('Erro ao salvar a ideia');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Aprovado': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Gravado': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Em edição': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Postado': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20'; // Ideia
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Quadro de Ideias</h2>
          <p className="text-sm text-muted-foreground">Gerencie o fluxo de criação de conteúdo do seu cliente.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Ideia
        </Button>
      </div>

      {ideas.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-foreground/10 bg-card/60 rounded-xl">
          <Lightbulb className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Nenhuma ideia de conteúdo</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Comece registrando as primeiras ideias para a estratégia desse cliente.
          </p>
          <Button onClick={handleOpenNewDialog} variant="secondary">
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira ideia
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <Card key={idea.id} className="border-foreground/5 bg-card hover:border-foreground/10 transition-colors flex flex-col h-full">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={getStatusColor(idea.status)}>
                    {idea.status || 'Ideia'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(idea)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(idea.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base line-clamp-2 mt-2" title={idea.title}>{idea.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-grow space-y-3">
                
                {idea.content_type && (
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <Video className="w-3.5 h-3.5" />
                    <span className="truncate">{idea.content_type}</span>
                  </div>
                )}
                
                {idea.pillar && (
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="truncate">{idea.pillar}</span>
                  </div>
                )}
                
                {idea.objective && (
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <Target className="w-3.5 h-3.5" />
                    <span className="truncate" title={idea.objective}>{idea.objective}</span>
                  </div>
                )}
                
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para Nova/Editar Ideia */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border-foreground/10 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingIdea?.id ? 'Editar Ideia' : 'Nova Ideia'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>A Ideia (Título)</Label>
              <Input 
                placeholder="Ex: 3 erros ao investir em imóveis" 
                value={editingIdea?.title || ''}
                onChange={(e) => setEditingIdea({ ...editingIdea, title: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select 
                  value={editingIdea?.content_type || ''} 
                  onValueChange={(val) => setEditingIdea({ ...editingIdea, content_type: val })}
                >
                  <SelectTrigger className="bg-muted/60 border-foreground/10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editingIdea?.status || ''} 
                  onValueChange={(val) => setEditingIdea({ ...editingIdea, status: val })}
                >
                  <SelectTrigger className="bg-muted/60 border-foreground/10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pilar Estratégico</Label>
              <Select 
                value={editingIdea?.pillar || ''} 
                onValueChange={(val) => setEditingIdea({ ...editingIdea, pillar: val })}
              >
                <SelectTrigger className="bg-muted/60 border-foreground/10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {clientPillars.length === 0 && <SelectItem value="vazio" disabled>Nenhum pilar cadastrado</SelectItem>}
                  {clientPillars.map(pillar => (
                    <SelectItem key={pillar} value={pillar}>{pillar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientPillars.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Crie pilares na aba "Linha Editorial" primeiro.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Objetivo do Vídeo/Post</Label>
              <Input 
                placeholder="Ex: Atrair seguidores / Vender consultoria" 
                value={editingIdea?.objective || ''}
                onChange={(e) => setEditingIdea({ ...editingIdea, objective: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-foreground/10">
              Cancelar
            </Button>
            <Button onClick={handleSaveIdea} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
