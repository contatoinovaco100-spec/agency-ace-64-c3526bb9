import { useState } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet, FileText, Upload, LayoutList, Download,
  Sparkles, Calendar, CheckCircle2, ArrowRight, Table, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PdfPlanningUpload } from '@/components/content/PdfPlanningUpload';
import { PdfPlanningCards } from '@/components/content/PdfPlanningCards';
import { generatePlanningTemplate } from '@/lib/pdfPlanningTemplate';
import { generateMonthlyExcelTemplate } from '@/lib/excelPlanningTemplate';
import type { PlanningItem } from '@/lib/pdfPlanningParser';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function PdfPlanningPage() {
  const { clients } = useAgency();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[currentMonthIdx]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const monthNameFormatted = `${selectedMonth} de ${selectedYear}`;

  const handleParsed = (parsed: PlanningItem[]) => {
    setItems(prev => [...prev, ...parsed]);
    setActiveTab('cards');
  };

  const handleDownloadExcel = () => {
    generateMonthlyExcelTemplate({
      clientName: selectedClient?.companyName || 'Cliente',
      monthName: monthNameFormatted,
      year: selectedYear,
    });
  };

  const handleDownloadPdf = () => {
    generatePlanningTemplate({
      clientName: selectedClient?.companyName || 'Cliente',
      monthName: monthNameFormatted,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* Header com Seletor de Cliente, Mês e Ano */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              Planejamento Mensal de Conteúdo
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hidden sm:inline-flex">
              Excel & PDF
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Baixe a planilha mensal, preencha no Excel e importe para gerar todos os cards no Kanban automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Cliente */}
          <div className="w-full sm:w-[260px]">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full bg-black/40 border-white/10 font-medium">
                <SelectValue placeholder="Selecione o cliente..." />
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

          {/* Seletor de Mês */}
          <div className="w-[140px]">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-black/40 border-white/10">
                <Calendar className="w-3.5 h-3.5 mr-1 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Ano */}
          <div className="w-[95px]">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-full bg-black/40 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedClientId ? (
        <div className="flex flex-col items-center justify-center min-h-[45vh] text-center space-y-4 rounded-2xl border border-white/5 bg-black/20 backdrop-blur-sm p-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-semibold text-white">Selecione um Cliente para Começar</h3>
            <p className="text-muted-foreground text-sm">
              Escolha o cliente acima para baixar a planilha mensal personalizada e importar o cronograma de vídeos e artes.
            </p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-black/40 border border-white/10 p-1">
              <TabsTrigger value="upload" className="data-[state=active]:bg-primary data-[state=active]:text-black font-semibold">
                <Upload className="w-4 h-4 mr-2" />
                Importar Arquivo
              </TabsTrigger>
              <TabsTrigger value="cards" className="data-[state=active]:bg-primary data-[state=active]:text-black font-semibold">
                <LayoutList className="w-4 h-4 mr-2" />
                Cards Extraídos {items.length > 0 && `(${items.length})`}
              </TabsTrigger>
              <TabsTrigger value="template" className="data-[state=active]:bg-primary data-[state=active]:text-black font-semibold">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400 data-[state=active]:text-black" />
                Planilha & Modelos
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Baixar Excel ({selectedMonth})
              </Button>

              {items.length > 0 && (
                <Button
                  onClick={() => setActiveTab('cards')}
                  size="sm"
                  className="bg-primary text-black font-bold shadow-lg shadow-primary/20"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Ver {items.length} Card{items.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>

          {/* ABA 1: UPLOAD / IMPORTAÇÃO */}
          <TabsContent value="upload" className="mt-0 space-y-6">
            <div className="border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Cliente selecionado: <strong className="text-white font-bold">{selectedClient?.companyName}</strong> ({monthNameFormatted})
                  </span>
                </div>
              </div>
              <PdfPlanningUpload onParsed={handleParsed} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/30 rounded-xl border border-white/5 p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  1
                </div>
                <h4 className="font-semibold text-white text-sm">1. Baixe o Excel ou PDF</h4>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Acesse a aba <strong>Planilha & Modelos</strong> e baixe a planilha formatada com as colunas certas para o cliente.
                </p>
              </div>

              <div className="bg-black/30 rounded-xl border border-white/5 p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  2
                </div>
                <h4 className="font-semibold text-white text-sm">2. Preencha no Excel</h4>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Insira as datas, títulos dos vídeos/artes e roteiros/legendas nas abas 🎬 Vídeos e 🎨 Artes.
                </p>
              </div>

              <div className="bg-black/30 rounded-xl border border-white/5 p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-sm">
                  3
                </div>
                <h4 className="font-semibold text-white text-sm">3. Arraste e Crie no Kanban</h4>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Solte o arquivo aqui para extrair tudo. Revise e envie todos os cards direto para o Kanban do cliente!
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: CARDS EXTRAÍDOS */}
          <TabsContent value="cards" className="mt-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[35vh] text-center space-y-4 rounded-2xl border border-white/5 bg-black/20 backdrop-blur-sm p-8">
                <LayoutList className="w-12 h-12 text-zinc-600" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Nenhum card importado ainda</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Faça upload da planilha preenchida ou do PDF para gerar os cards deste mês.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('upload')}
                    className="border-primary/50 text-primary hover:bg-primary/10 mt-2"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Fazer Upload do Arquivo
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

          {/* ABA 3: TEMPLATES & MODELOS (EXCEL E PDF) */}
          <TabsContent value="template" className="mt-0 space-y-6">
            <div className="border border-white/5 bg-black/20 rounded-2xl p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="text-2xl font-bold text-white">Planilha Mensal de Conteúdo (Excel)</h3>
                <p className="text-zinc-400 text-sm">
                  Planilha completa e organizada para preenchimento no Excel / Google Sheets com abas separadas para <strong>Vídeos</strong>, <strong>Artes</strong> e <strong>Instruções</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  onClick={handleDownloadExcel}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-6 py-3 text-sm shadow-lg shadow-emerald-500/20"
                  size="lg"
                >
                  <FileSpreadsheet className="w-5 h-5 mr-2" />
                  Baixar Planilha Excel (.xlsx)
                </Button>

                <Button
                  onClick={handleDownloadPdf}
                  variant="outline"
                  className="border-white/10 hover:bg-white/5 font-semibold text-zinc-300"
                  size="lg"
                >
                  <FileText className="w-5 h-5 mr-2 text-primary" />
                  Baixar Modelo em PDF
                </Button>
              </div>

              {/* Detalhes das seções da planilha */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left max-w-3xl mx-auto">
                <div className="bg-black/40 rounded-xl border border-blue-500/20 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">🎬</span>
                    <h4 className="font-semibold text-blue-400">Aba 1: Produção de Vídeos</h4>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Ideal para Reels, TikToks, Shorts e gravações. Inclui colunas para <strong>Data</strong>, <strong>Título</strong>, <strong>Formato</strong>, <strong>Roteiro/Briefing</strong> e <strong>Observações</strong>.
                  </p>
                </div>

                <div className="bg-black/40 rounded-xl border border-purple-500/20 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-bold">🎨</span>
                    <h4 className="font-semibold text-purple-400">Aba 2: Artes & Design</h4>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Ideal para posts estáticos, carrosséis, stories e banners. Inclui colunas para <strong>Data</strong>, <strong>Título</strong>, <strong>Legenda/Copy</strong> e <strong>Direção Visual</strong>.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  );
}

