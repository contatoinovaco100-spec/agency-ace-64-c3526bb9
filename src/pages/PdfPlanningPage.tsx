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
            <div className="border border-white/5 bg-black/20 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-7 h-7 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cronograma Mensal de Postagens (Excel & PDF)</h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      Modelo profissional com estrutura em blocos: <strong>Data</strong>, <strong>Turno</strong>, <strong>Status</strong>, <strong>Canal</strong>, <strong>Formato</strong>, <strong>Objetivo</strong> e <strong>Direcionamento</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={handleDownloadExcel}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 shadow-lg shadow-purple-600/20"
                    size="sm"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Baixar Planilha Excel (.xlsx)
                  </Button>

                  <Button
                    onClick={handleDownloadPdf}
                    variant="outline"
                    className="border-white/10 hover:bg-white/5 font-semibold text-zinc-300"
                    size="sm"
                  >
                    <FileText className="w-4 h-4 mr-2 text-primary" />
                    Baixar em PDF
                  </Button>
                </div>
              </div>

              {/* Preview Visual no Estilo da Imagem de Referência */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Table className="w-4 h-4" />
                    Pré-visualização do Modelo de Planilha
                  </span>
                  <span className="text-xs text-zinc-500">Formato idêntico ao arquivo .xlsx gerado</span>
                </div>

                <div className="rounded-xl overflow-hidden border border-purple-500/30 shadow-2xl bg-[#1e1338]">
                  {/* Banner Roxo Superior */}
                  <div className="bg-[#492285] py-3.5 px-4 text-center border-b border-purple-400/20">
                    <h4 className="text-lg md:text-xl font-black text-white tracking-wide">
                      Cronograma de postagens
                    </h4>
                  </div>
                  <div className="bg-[#6b35bf] py-1.5 px-4 text-center text-xs font-bold uppercase tracking-widest text-purple-100">
                    MÊS DE REFERÊNCIA: {monthNameFormatted.toUpperCase()} — {selectedClient?.companyName.toUpperCase()}
                  </div>

                  {/* Tabela Formatada */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-[#783bd4] text-white font-bold text-center border-b border-purple-400/30">
                          <th className="p-2.5 border-r border-purple-400/20 w-24">Data</th>
                          <th className="p-2.5 border-r border-purple-400/20 w-24">Turno</th>
                          <th className="p-2.5 border-r border-purple-400/20 w-28">Status</th>
                          <th className="p-2.5 border-r border-purple-400/20 w-28">Canal</th>
                          <th className="p-2.5 border-r border-purple-400/20 w-28">Formato</th>
                          <th className="p-2.5 border-r border-purple-400/20 w-28">Objetivo</th>
                          <th className="p-2.5 border-r border-purple-400/20 text-left pl-4">Direcionamento / Tema</th>
                          <th className="p-2.5 w-32">Obs.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-500/15 text-zinc-200">
                        <tr className="hover:bg-purple-500/10 transition-colors">
                          <td className="p-2.5 text-center font-bold text-purple-200 bg-purple-950/40 border-r border-purple-400/20">QUA (08/10)</td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3e1d68] text-purple-200 border border-purple-400/30">
                              Manhã ▾
                            </span>
                          </td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Em revisão ▾
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Instagram ▾</td>
                          <td className="p-2.5 text-center font-bold text-purple-300 border-r border-purple-400/20">STORIES ▾</td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Institucional</td>
                          <td className="p-2.5 pl-4 border-r border-purple-400/20 font-medium">Missão da marca e bastidores do dia a dia</td>
                          <td className="p-2.5 text-zinc-400 text-[11px]">Gravação interna</td>
                        </tr>

                        <tr className="hover:bg-purple-500/10 transition-colors">
                          <td className="p-2.5 text-center font-bold text-purple-200 bg-purple-950/40 border-r border-purple-400/20">QUA (08/10)</td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-950/80 text-red-200 border border-red-500/30">
                              Tarde ▾
                            </span>
                          </td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              Programado ▾
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Linkedin ▾</td>
                          <td className="p-2.5 text-center font-bold text-purple-300 border-r border-purple-400/20">CARD ▾</td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Serviço</td>
                          <td className="p-2.5 pl-4 border-r border-purple-400/20 font-medium">Apresentação do serviço principal com foco em B2B</td>
                          <td className="p-2.5 text-zinc-400 text-[11px]">Carrossel 4 slides</td>
                        </tr>

                        <tr className="hover:bg-purple-500/10 transition-colors">
                          <td className="p-2.5 text-center font-bold text-purple-200 bg-purple-950/40 border-r border-purple-400/20">QUI (09/10)</td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/80 text-blue-200 border border-blue-500/30">
                              Noite ▾
                            </span>
                          </td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/20 text-orange-300 border border-orange-400/30">
                              Em criação ▾
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">YouTube ▾</td>
                          <td className="p-2.5 text-center font-bold text-purple-300 border-r border-purple-400/20">VÍDEO ▾</td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Produto</td>
                          <td className="p-2.5 pl-4 border-r border-purple-400/20 font-medium">Demonstração prática do produto com gancho forte</td>
                          <td className="p-2.5 text-zinc-400 text-[11px]">Reels dinâmico</td>
                        </tr>

                        <tr className="hover:bg-purple-500/10 transition-colors">
                          <td className="p-2.5 text-center font-bold text-purple-200 bg-purple-950/40 border-r border-purple-400/20">SEX (10/10)</td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3e1d68] text-purple-200 border border-purple-400/30">
                              Manhã ▾
                            </span>
                          </td>
                          <td className="p-2 text-center border-r border-purple-400/20">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              Programado ▾
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Instagram ▾</td>
                          <td className="p-2.5 text-center font-bold text-purple-300 border-r border-purple-400/20">REELS ▾</td>
                          <td className="p-2.5 text-center text-zinc-300 border-r border-purple-400/20">Topo de Funil</td>
                          <td className="p-2.5 pl-4 border-r border-purple-400/20 font-medium">3 Dicas rápidas para resolver a dor do cliente</td>
                          <td className="p-2.5 text-zinc-400 text-[11px]">Áudio em alta</td>
                        </tr>
                      </tbody>
                    </table>
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


