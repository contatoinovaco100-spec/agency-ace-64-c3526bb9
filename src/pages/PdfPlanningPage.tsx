import { useState } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Upload, LayoutList, Download, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { PdfPlanningUpload } from '@/components/content/PdfPlanningUpload';
import { PdfPlanningCards } from '@/components/content/PdfPlanningCards';
import { generatePlanningTemplate } from '@/lib/pdfPlanningTemplate';
import type { PlanningItem } from '@/lib/pdfPlanningParser';

export default function PdfPlanningPage() {
  const { clients } = useAgency();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  const handleParsed = (parsed: PlanningItem[]) => {
    setItems(prev => [...prev, ...parsed]);
    setActiveTab('cards');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            Planejamento via PDF
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie o planejamento em PDF e a plataforma cria os cards automaticamente.
          </p>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
          <div className="w-full sm:w-[300px]">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full bg-black/40 border-white/10">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedClientId ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-semibold">Selecione um Cliente</h3>
            <p className="text-muted-foreground text-sm">
              Escolha um cliente para enviar o planejamento de conteúdo em PDF e gerar os cards no Kanban.
            </p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-black/40 border border-white/10">
              <TabsTrigger value="upload" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </TabsTrigger>
              <TabsTrigger value="cards" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                <LayoutList className="w-4 h-4 mr-2" />
                Cards {items.length > 0 && `(${items.length})`}
              </TabsTrigger>
              <TabsTrigger value="template" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                <FileText className="w-4 h-4 mr-2" />
                Template
              </TabsTrigger>
            </TabsList>

            {items.length > 0 && (
              <Button
                onClick={() => setActiveTab('cards')}
                className="bg-primary text-black font-bold shadow-lg shadow-primary/20"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ver {items.length} Card{items.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          <TabsContent value="upload" className="mt-0">
            <div className="space-y-6">
              <PdfPlanningUpload onParsed={handleParsed} />

              <div className="border border-white/5 bg-black/20 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Como funciona?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex gap-3 p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Envie o PDF</p>
                      <p className="text-zinc-500 mt-1">Arraste ou selecione o arquivo de planejamento</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Interpretação</p>
                      <p className="text-zinc-500 mt-1">A plataforma extrai datas, títulos e classifica</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Crie os Cards</p>
                      <p className="text-zinc-500 mt-1">Importe para o Kanban com um clique</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cards" className="mt-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[30vh] text-center space-y-4 rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm p-8">
                <LayoutList className="w-12 h-12 text-zinc-600" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Nenhum card ainda</h3>
                  <p className="text-muted-foreground text-sm">
                    Faça upload de um PDF na aba anterior para gerar os cards.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('upload')}
                    className="border-primary/50 text-primary hover:bg-primary/10 mt-2"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Fazer Upload
                  </Button>
                </div>
              </div>
            ) : (
              <PdfPlanningCards
                items={items}
                onChange={setItems}
                clientId={selectedClientId}
              />
            )}
          </TabsContent>

          <TabsContent value="template" className="mt-0">
            <div className="space-y-6">
              <div className="border border-white/5 bg-black/20 rounded-xl p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Download className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Template de Planejamento</h3>
                  <p className="text-zinc-400 text-sm max-w-md mx-auto">
                    Baixe o template em PDF com tabelas pré-formatadas para vídeos e artes.
                    Preencha, salve e faça upload para importar automaticamente.
                  </p>
                </div>
                <Button
                  onClick={() => generatePlanningTemplate()}
                  className="bg-primary text-black font-bold px-8 py-3 text-base shadow-lg shadow-primary/20"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Baixar Template PDF
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-left max-w-2xl mx-auto">
                  <div className="bg-black/40 rounded-xl border border-white/5 p-5 space-y-2">
                    <h4 className="font-semibold text-blue-400">Seção de Vídeos</h4>
                    <p className="text-zinc-500 text-sm">
                      Reels, TikToks, YouTube Shorts, conteúdos gravados. Preencha data, título e descrição.
                    </p>
                  </div>
                  <div className="bg-black/40 rounded-xl border border-white/5 p-5 space-y-2">
                    <h4 className="font-semibold text-purple-400">Seção de Artes</h4>
                    <p className="text-zinc-500 text-sm">
                      Posts, carrosséis, stories, banners. Preencha data, título e descrição.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  );
}
