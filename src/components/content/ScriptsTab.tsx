import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Edit, Trash2, Link as LinkIcon, FileText, Sparkles, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ContentIdea {
  id: string;
  title: string;
}

interface ContentScript {
  id: string;
  idea_id: string | null;
  title: string | null;
  hook: string | null;
  development: string | null;
  cta: string | null;
  observations: string | null;
  idea_title?: string; // Transformed property for display
}

export function ScriptsTab({ clientId }: { clientId: string }) {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingScript, setEditingScript] = useState<Partial<ContentScript> | null>(null);

  // AI State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  useEffect(() => {
    loadData();
    // Check if API key exists on mount
    if (localStorage.getItem('OPENAI_API_KEY')) {
      setHasApiKey(true);
    }
  }, [clientId]);

  async function loadData() {
    if (!clientId) return;
    setLoading(true);
    try {
      // Fetch ideas for the dropdown
      const { data: ideasData, error: ideasError } = await supabase
        .from('content_ideas')
        .select('id, title')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (ideasError) throw ideasError;
      setIdeas(ideasData || []);

      // Fetch scripts
      // Since scripts don't have client_id directly, we need to fetch them.
      // Wait, our schema design: content_scripts only has `idea_id`. 
      // How do we get all scripts for a client? 
      // We can fetch all scripts where idea_id is IN (client's ideas), 
      // OR we can add client_id to content_scripts.
      // Since we didn't add client_id to content_scripts in SQL, we must join or query via ideas.
      const ideaIds = (ideasData || []).map(i => i.id);
      
      if (ideaIds.length > 0) {
        const { data: scriptsData, error: scriptsError } = await supabase
          .from('content_scripts')
          .select('*')
          .in('idea_id', ideaIds)
          .order('created_at', { ascending: false });
          
        if (scriptsError) throw scriptsError;
        
        // Map idea titles to scripts for easier display
        const mappedScripts = (scriptsData || []).map(script => {
          const matchedIdea = ideasData?.find(i => i.id === script.idea_id);
          return {
            ...script,
            idea_title: matchedIdea?.title || 'Ideia não encontrada'
          };
        });
        
        setScripts(mappedScripts);
      } else {
        setScripts([]);
      }
      
    } catch (error) {
      console.error('Error loading scripts:', error);
      toast.error('Erro ao carregar os roteiros');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNewDialog = () => {
    setEditingScript({
      title: '',
      idea_id: ideas.length > 0 ? ideas[0].id : null,
      hook: '',
      development: '',
      cta: '',
      observations: ''
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (script: ContentScript) => {
    setEditingScript({ ...script });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja apagar este roteiro?')) return;
    try {
      const { error } = await supabase.from('content_scripts').delete().eq('id', id);
      if (error) throw error;
      setScripts(scripts.filter(s => s.id !== id));
      toast.success('Roteiro excluído com sucesso!');
    } catch (err) {
      console.error('Error deleting script:', err);
      toast.error('Erro ao excluir roteiro');
    }
  };

  const handleSaveScript = async () => {
    if (!editingScript?.idea_id) {
      toast.error('O roteiro precisa estar vinculado a uma Ideia de Conteúdo.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        idea_id: editingScript.idea_id,
        title: editingScript.title || 'Sem título',
        hook: editingScript.hook,
        development: editingScript.development,
        cta: editingScript.cta,
        observations: editingScript.observations,
      };

      if (editingScript.id) {
        // Update
        const { error } = await supabase
          .from('content_scripts')
          .update(payload)
          .eq('id', editingScript.id);
        if (error) throw error;
        
        const matchedIdea = ideas.find(i => i.id === payload.idea_id);
        setScripts(scripts.map(s => s.id === editingScript.id ? { ...s, ...payload, idea_title: matchedIdea?.title } as ContentScript : s));
        toast.success('Roteiro atualizado com sucesso!');
      } else {
        // Insert
        const { data, error } = await supabase
          .from('content_scripts')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        
        const matchedIdea = ideas.find(i => i.id === payload.idea_id);
        setScripts([{ ...data, idea_title: matchedIdea?.title } as ContentScript, ...scripts]);
        toast.success('Novo roteiro criado com sucesso!');
      }
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Error saving script:', err);
      toast.error('Erro ao salvar o roteiro');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite sobre o que será o vídeo.');
      return;
    }
    
    // Check for API key
    let apiKey = localStorage.getItem('OPENAI_API_KEY');
    if (!apiKey) {
      toast.error("Chave da API não encontrada. Por favor, configure a sua chave.");
      setHasApiKey(false);
      return;
    }

    setGeneratingAi(true);
    try {
      // Tenta buscar a linha editorial para contexto, ignorando erros se a tabela não existir
      let edLine = null;
      try {
        const { data } = await supabase
          .from('content_editorial_lines')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();
        edLine = data;
      } catch (e) {
        // Silently handle error - will use general context
      }
        
      const systemPrompt = `Você é um copywriter de alto nível e roteirista para redes sociais. Sua missão é criar um roteiro curto, engajador e direto ao ponto para Reels/TikTok.
      Aqui está o Contexto Estratégico do Cliente:
      - Nicho: ${edLine?.niche || 'Geral (Qualquer nicho)'}
      - Público-alvo: ${edLine?.audience || 'Público geral focado em conteúdo rápido'}
      - Tom de voz: ${edLine?.tone || 'Descontraído mas agregando valor'}
      - Objetivo principal: ${edLine?.objective || 'Visualizações e Engajamento'}
      
      Com base no tema que o usuário pedir, escreva o roteiro com 3 partes:
      1) Gancho inicial: Uma primeira frase extremamente forte e curiosa (os primeiros 3 segundos).
      2) Desenvolvimento: O corpo do vídeo contando de forma rápida, fluída e sem se arrastar sobre o assunto. Use quebras curtas.
      3) CTA: Chamada para ação simples e clara no final.
      
      Retorne EXCLUSIVAMENTE um objeto JSON válido no formato:
      {"hook": "texto", "development": "texto", "cta": "texto"}
      
      Não inclua marcações de markdown e nem explique nada. Apenas responda com o JSON puro.`;

      const { data, error } = await supabase.functions.invoke('ai-copywriter', {
        body: { 
          systemPrompt, 
          userMessage: aiPrompt,
          apiKey: apiKey
        }
      });

      if (error) {
        // Handle Edge function invocation error
        console.error("Invoke error:", error);
        throw new Error("Falha ao comunicar com o servidor (Edge Function). Verifique sua conexão.");
      }

      if (data?.error) {
        // Handle explicit error from Edge function (e.g., API Key invalid)
        if (data.error.toLowerCase().includes("auth") || data.error.toLowerCase().includes("key")) {
           localStorage.removeItem('OPENAI_API_KEY');
           setHasApiKey(false);
           setTempApiKey('');
        }
        throw new Error(data.error);
      }

      if (data?.result) {
        setEditingScript(prev => ({
          ...prev,
          title: prev?.title || aiPrompt.substring(0, 30) + '...',
          hook: data.result.hook || prev?.hook,
          development: data.result.development || prev?.development,
          cta: data.result.cta || prev?.cta
        }));
        toast.success('Roteiro gerado com sucesso!');
        setIsAiOpen(false);
        setAiPrompt("");
      } else {
        throw new Error("A resposta da IA veio vazia ou corrompida.");
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(`Erro na IA: ${err.message || 'Falha ao conectar com o serviço'}`);
    } finally {
      setGeneratingAi(false);
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
          <h2 className="text-xl font-semibold">Organizador de Roteiros</h2>
          <p className="text-sm text-muted-foreground">Transforme as ideias aprovadas em roteiros detalhados.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Roteiro
        </Button>
      </div>

      {ideas.length === 0 ? (
        <div className="p-4 border border-yellow-500/20 bg-yellow-500/10 rounded-lg text-yellow-200 text-sm">
          <strong>Atenção:</strong> Você precisa criar pelo menos uma "Ideia de Conteúdo" antes de poder escrever um roteiro. Os roteiros são obrigatoriamente vinculados às ideias.
        </div>
      ) : null}

      {scripts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-foreground/10 bg-card/60 rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Nenhum roteiro escrito</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Pegue suas melhores ideias e comece a estruturar gancho, desenvolvimento e chamadas para ação.
          </p>
          <Button onClick={handleOpenNewDialog} variant="secondary" disabled={ideas.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Escrever primeiro roteiro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scripts.map((script) => (
            <Card key={script.id} className="border-foreground/5 bg-card flex flex-col h-full">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center text-xs text-primary bg-primary/10 px-2 py-1 rounded-md mb-2">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    <span className="truncate max-w-[200px]" title={script.idea_title}>{script.idea_title}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(script)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(script.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg mt-1">{script.title || "Sem título"}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-grow space-y-4">
                
                {script.hook ? (
                   <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gancho Inicial</span>
                    <p className="text-sm line-clamp-2">{script.hook}</p>
                   </div>
                ) : null}

                 {script.cta ? (
                   <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to Action</span>
                    <p className="text-sm line-clamp-2">{script.cta}</p>
                   </div>
                ) : null}
                
                {!script.hook && !script.development && !script.cta && (
                  <p className="text-sm text-muted-foreground italic">Roteiro em branco.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border-foreground/10 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingScript?.id ? 'Editar Roteiro' : 'Novo Roteiro'}</DialogTitle>
            <DialogDescription>
              Estruture seu roteiro com gancho, desenvolvimento e chamada para ação.
            </DialogDescription>
          </DialogHeader>

          {!isAiOpen ? (
            <Button
              variant="outline"
              className="w-full justify-start border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 mt-2"
              onClick={() => setIsAiOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              ✨ Gerar Roteiro com IA
            </Button>
          ) : (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 mt-2 animate-in fade-in zoom-in-95 duration-200">
              {!hasApiKey ? (
                <>
                  <Label className="text-primary font-semibold flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> Configurar Inteligência Artificial
                  </Label>
                  <p className="text-sm text-muted-foreground">Para começar a gerar roteiros magicamente, cole sua chave da API da OpenAI (sk-...). Ela ficará salva com segurança apenas no seu navegador.</p>
                  <Input 
                    type="password"
                    placeholder="sk-proj-..." 
                    value={tempApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    className="bg-muted/60 border-primary/20 focus-visible:ring-primary/30"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsAiOpen(false)}>Cancelar</Button>
                    <Button size="sm" onClick={() => {
                      if(tempApiKey.trim().startsWith('sk-')) {
                        localStorage.setItem('OPENAI_API_KEY', tempApiKey.trim());
                        setHasApiKey(true);
                        toast.success("Chave salva com sucesso!");
                      } else {
                        toast.error("Formato de chave inválido. Deve começar com 'sk-'");
                      }
                    }} className="bg-primary text-primary-foreground">Atualizar Chave</Button>
                  </div>
                </>
              ) : (
                <>
                  <Label className="text-primary font-semibold flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> Sobre o que será este vídeo?
                  </Label>
                  <Textarea 
                    placeholder="Ex: Dá 3 dicas de como evitar quebra de cabelo no banho..." 
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    className="bg-muted/60 border-primary/20 focus-visible:ring-primary/30 min-h-[80px]"
                  />
                  <div className="flex gap-2 justify-between items-center mt-2">
                    <button onClick={() => {
                      localStorage.removeItem('OPENAI_API_KEY');
                      setHasApiKey(false);
                      setTempApiKey('');
                    }} className="text-xs text-muted-foreground hover:text-red-400 transition-colors underline">
                      Trocar chave da API
                    </button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsAiOpen(false)} disabled={generatingAi}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleGenerateAI} disabled={generatingAi} className="bg-primary text-primary-foreground">
                        {generatingAi ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                        {generatingAi ? 'Pensando...' : 'Criar Mágica'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 py-4">
            
            <div className="space-y-2">
              <Label>Vincular à Ideia <span className="text-red-500">*</span></Label>
              <Select 
                value={editingScript?.idea_id || ''} 
                onValueChange={(val) => setEditingScript({ ...editingScript, idea_id: val })}
              >
                <SelectTrigger className="bg-muted/60 border-foreground/10">
                  <SelectValue placeholder="Selecione uma ideia para basear este roteiro..." />
                </SelectTrigger>
                <SelectContent>
                  {ideas.map(idea => (
                    <SelectItem key={idea.id} value={idea.id}>{idea.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título Interno do Roteiro</Label>
              <Input 
                placeholder="Ex: Roteiro Reel Investimentos" 
                value={editingScript?.title || ''}
                onChange={(e) => setEditingScript({ ...editingScript, title: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>

            <div className="space-y-2">
              <Label>Gancho Inicial (Os primeiros 3 segundos)</Label>
              <Textarea 
                placeholder="Como você vai prender a atenção do espectador logo de cara?" 
                value={editingScript?.hook || ''}
                onChange={(e) => setEditingScript({ ...editingScript, hook: e.target.value })}
                className="bg-muted/60 border-foreground/10 min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Desenvolvimento (Corpo do vídeo)</Label>
              <Textarea 
                placeholder="O conteúdo em si. Tópicos, explicações e argumentos." 
                value={editingScript?.development || ''}
                onChange={(e) => setEditingScript({ ...editingScript, development: e.target.value })}
                className="bg-muted/60 border-foreground/10 min-h-[150px]"
              />
            </div>

            <div className="space-y-2">
              <Label>CTA (Call to Action)</Label>
              <Input 
                placeholder="Ex: 'Comente EU QUERO para receber o link no direct'" 
                value={editingScript?.cta || ''}
                onChange={(e) => setEditingScript({ ...editingScript, cta: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>

            <div className="space-y-2 mt-2">
              <Label>Observações para Gravação</Label>
              <Textarea 
                placeholder="Ex: Gravar em ambiente claro, usar microfone de lapela, focar no rosto." 
                value={editingScript?.observations || ''}
                onChange={(e) => setEditingScript({ ...editingScript, observations: e.target.value })}
                className="bg-muted/60 border-foreground/10 min-h-[80px]"
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-foreground/10">
              Cancelar
            </Button>
            <Button onClick={handleSaveScript} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Roteiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
