import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, X, FileDown, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAgency } from '@/contexts/AgencyContext';

interface EditorialLine {
  niche: string;
  audience: string;
  tone: string;
  objective: string;
  pillars: string[];
}

export function EditorialLineTab({ clientId }: { clientId: string }) {
  const { clients } = useAgency();
  const clientName = clients.find(c => c.id === clientId)?.companyName || 'Cliente';

  const [previewMode, setPreviewMode] = useState(false);
  const [editorialLine, setEditorialLine] = useState<EditorialLine>({
    niche: '',
    audience: '',
    tone: '',
    objective: '',
    pillars: [],
  });
  const [newPillar, setNewPillar] = useState('');

  const addPillar = () => {
    if (!newPillar.trim()) return;
    if (editorialLine.pillars.includes(newPillar.trim())) return; // Prevent duplicates
    
    setEditorialLine(prev => ({
      ...prev,
      pillars: [...prev.pillars, newPillar.trim()]
    }));
    setNewPillar('');
  };

  const removePillar = (pillarToRemove: string) => {
    setEditorialLine(prev => ({
      ...prev,
      pillars: prev.pillars.filter(p => p !== pillarToRemove)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPillar();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (previewMode) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => setPreviewMode(false)} className="border-foreground/10">
            <Edit3 className="w-4 h-4 mr-2" />
            Voltar para Edição
          </Button>
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
            <FileDown className="w-4 h-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-2xl max-w-4xl mx-auto print:shadow-none print:w-full print:m-0 print:p-0">
          <div className="border-b-2 border-primary pb-6 mb-8 mt-4">
            <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Manual de Marca e Conteúdo</h1>
            <p className="text-xl text-zinc-500 mt-2 font-medium">Doc Estratégico Oficial: {clientName}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Nicho de Mercado</h3>
              <p className="text-lg text-zinc-800 leading-relaxed border-l-4 border-primary/20 pl-4">
                {editorialLine.niche || 'Não definido'}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Objetivo do Conteúdo</h3>
              <p className="text-lg text-zinc-800 leading-relaxed border-l-4 border-primary/20 pl-4">
                {editorialLine.objective || 'Não definido'}
              </p>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Público-alvo / Avatar</h3>
              <p className="text-lg text-zinc-800 leading-relaxed bg-zinc-50 p-6 rounded-lg border border-zinc-100 italic">
                "{editorialLine.audience || 'Não definido'}"
              </p>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Tom de Comunicação</h3>
              <p className="text-lg text-zinc-800 leading-relaxed bg-zinc-50 p-6 rounded-lg border border-zinc-100 italic">
                "{editorialLine.tone || 'Não definido'}"
              </p>
            </div>

            <div className="space-y-4 md:col-span-2 pt-6 border-t border-zinc-100">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Pilares de Conteúdo Aprovados</h3>
              {editorialLine.pillars.length === 0 ? (
                <p className="text-zinc-500 italic">Nenhum pilar estratégico definido.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editorialLine.pillars.map((pillar, index) => (
                     <div key={index} className="flex items-start gap-4 p-4 rounded-xl border border-zinc-200 bg-white shadow-sm">
                       <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                         {index + 1}
                       </div>
                       <p className="font-semibold text-zinc-800 pt-1 text-lg">{pillar}</p>
                     </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          
          <div className="mt-16 pt-8 border-t border-zinc-200 text-center text-sm text-zinc-400 print:mt-24">
            Gerado via Painel Estratégico Interativo
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
        <div>
          <h3 className="text-primary font-semibold flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Gerador Offline de Linha Editorial
          </h3>
          <p className="text-sm text-primary/80 mt-1">
            Reúna as informações e gere um documento visual instantâneo para baixar e enviar pro cliente.
          </p>
        </div>
      </div>

      <Card className="border-foreground/5 bg-card">
        <CardHeader>
          <CardTitle>Identidade Estratégica</CardTitle>
          <CardDescription>
            Defina o posicionamento do cliente. Estas informações vão focar exclusivamente no PDF de saída.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho de Mercado</Label>
              <Input 
                id="niche" 
                placeholder="Ex: Saúde, Estética, Tecnologia, Direito..." 
                value={editorialLine.niche}
                onChange={(e) => setEditorialLine({ ...editorialLine, niche: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo do Conteúdo</Label>
              <Input 
                id="objective" 
                placeholder="Ex: Vendas, Autoridade, Engajamento, Branding..." 
                value={editorialLine.objective}
                onChange={(e) => setEditorialLine({ ...editorialLine, objective: e.target.value })}
                className="bg-muted/60 border-foreground/10"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="audience">Público-alvo / Avatar</Label>
              <Textarea 
                id="audience" 
                placeholder="Descreva quem é o cliente ideal. Ex: Homens e mulheres de 25 a 45 anos que buscam investir em imóveis de alto padrão."
                value={editorialLine.audience}
                onChange={(e) => setEditorialLine({ ...editorialLine, audience: e.target.value })}
                className="min-h-[80px] bg-muted/60 border-foreground/10 resize-none"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tone">Tom de Comunicação</Label>
              <Textarea 
                id="tone" 
                placeholder="Ex: Educativo, descontraído, autoridade técnica, inspiracional..."
                value={editorialLine.tone}
                onChange={(e) => setEditorialLine({ ...editorialLine, tone: e.target.value })}
                className="bg-muted/60 border-foreground/10 resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-foreground/5 bg-card">
        <CardHeader>
          <CardTitle>Pilares de Conteúdo</CardTitle>
          <CardDescription>
            Adicione as bases centrais que norteiam a produção diária.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Digite um pilar e pressione Enter..." 
                value={newPillar}
                onChange={(e) => setNewPillar(e.target.value)}
                onKeyDown={handleKeyDown}
                className="max-w-md bg-muted/60 border-foreground/10"
              />
              <Button type="button" variant="secondary" onClick={addPillar}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {editorialLine.pillars.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center">
                  Nenhum pilar adicionado.
                </p>
              ) : (
                editorialLine.pillars.map((pillar) => (
                  <Badge 
                    key={pillar} 
                    variant="secondary"
                    className="py-1 px-3 flex items-center gap-1 text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  >
                    {pillar}
                    <button 
                      onClick={() => removePillar(pillar)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted/60 transition-colors focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                      <span className="sr-only">Remover {pillar}</span>
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={() => setPreviewMode(true)} className="w-full sm:w-auto h-12 px-8 text-md shadow-lg shadow-primary/20">
          <FileDown className="w-5 h-5 mr-2" />
          Gerar Documento Final (PDF)
        </Button>
      </div>
    </div>
  );
}
