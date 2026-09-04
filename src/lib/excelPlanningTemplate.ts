import * as XLSX from 'xlsx';
import type { PlanningItem, PlanningItemType } from './pdfPlanningParser';

export interface MonthlyPlanningExportOptions {
  clientName?: string;
  monthName?: string; // ex: "Outubro de 2026"
  year?: number;
}

export function generateMonthlyExcelTemplate(options?: MonthlyPlanningExportOptions) {
  const wb = XLSX.utils.book_new();

  const clientName = options?.clientName || 'Cliente';
  const monthName = options?.monthName || 'MÊS DE REFERÊNCIA';

  // 1. CRONOGRAMA GERAL (Estilo da imagem de referência)
  const cronogramaHeaders = [
    ['Cronograma de postagens'],
    [`MÊS DE REFERÊNCIA: ${monthName.toUpperCase()} — CLIENTE: ${clientName.toUpperCase()}`],
    ['Data', 'Turno', 'Status', 'Canal', 'Formato', 'Objetivo', 'Direcionamento / Título & Roteiro', 'Obs.']
  ];

  const sampleCronograma = [
    ['QUA (08/10)', 'Manhã', 'Em revisão', 'Instagram', 'STORIES', 'Institucional', 'Missão da marca e bastidores do dia a dia da equipe', 'Gravação interna'],
    ['QUA (08/10)', 'Tarde', 'Programado', 'Linkedin / Feed', 'CARD', 'Serviço', 'Apresentação do serviço principal com foco em autoridade e B2B', 'Carrossel 4 slides'],
    ['QUI (09/10)', 'Noite', 'Em criação', 'Instagram / TikTok', 'VÍDEO', 'Produto', 'Demonstração prática do produto com gancho forte nos 3s iniciais', 'Reels dinâmico'],
    ['SEX (10/10)', 'Manhã', 'Programado', 'Instagram', 'REELS', 'Topo de Funil', '3 Dicas rápidas para resolver a principal dor do cliente', 'Áudio em alta'],
    ['SEG (13/10)', 'Tarde', 'A fazer', 'Instagram', 'CARROSSEL', 'Educativo', 'Guia prático passo a passo de como contratar ou usar o serviço', 'Design clean'],
    ['TER (14/10)', 'Noite', 'A fazer', 'Instagram / YouTube', 'VÍDEO', 'Prova Social', 'Depoimento de cliente com resultado obtido', 'Legenda dinâmica'],
    ['QUA (15/10)', 'Manhã', 'A fazer', 'Instagram', 'STORIES', 'Interação', 'Caixinha de perguntas + enquete sobre a rotina', 'Sticker de enquete'],
    ['QUI (16/10)', 'Tarde', 'A fazer', 'Instagram', 'POST', 'Comercial', 'Oferta especial da semana com chamada para o WhatsApp/Direct', 'Link na bio'],
    ['SEX (17/10)', 'Noite', 'A fazer', 'Instagram / TikTok', 'REELS', 'Viral', 'Tendência/meme adaptado ao nicho do cliente', 'Humor inteligente'],
    ['SEG (20/10)', 'Manhã', 'A fazer', 'Instagram', 'CARROSSEL', 'Autoridade', 'Mitos vs Verdades sobre o setor', 'Salvar o post'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];

  const wsGeral = XLSX.utils.aoa_to_sheet([...cronogramaHeaders, ...sampleCronograma]);

  // Mesclagem de títulos no topo
  wsGeral['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Título principal (Cronograma de postagens)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtítulo (Mês de referência)
  ];

  // Larguras ajustadas para leitura e preenchimento confortável
  wsGeral['!cols'] = [
    { wch: 16 }, // Data
    { wch: 14 }, // Turno (Manhã / Tarde / Noite)
    { wch: 16 }, // Status (Em revisão / Programado / Em criação / A fazer)
    { wch: 20 }, // Canal (Instagram / TikTok / YouTube / Linkedin)
    { wch: 16 }, // Formato (STORIES / CARD / VÍDEO / REELS / CARROSSEL)
    { wch: 20 }, // Objetivo (Institucional / Serviço / Produto / Topo de Funil)
    { wch: 55 }, // Direcionamento (Tema / Roteiro / Legenda)
    { wch: 28 }, // Obs.
  ];

  XLSX.utils.book_append_sheet(wb, wsGeral, '📅 Cronograma Mensal');

  // 2. ABA PRODUÇÃO DE VÍDEOS
  const videoHeaders = [
    ['Cronograma de Vídeos (Reels / TikTok / YouTube Shorts)'],
    [`MÊS: ${monthName.toUpperCase()} — CLIENTE: ${clientName.toUpperCase()}`],
    ['Data', 'Turno', 'Status', 'Canal', 'Formato', 'Objetivo', 'Direcionamento / Gancho & Roteiro', 'Obs.']
  ];

  const sampleVideos = [
    ['08/10/2026', 'Noite', 'Em criação', 'Instagram / TikTok', 'REELS', 'Topo de Funil', 'Gancho: Você comete esse erro todos os dias? Revelar solução em 3 passos.', 'Gravar na vertical 9:16'],
    ['12/10/2026', 'Tarde', 'Programado', 'Instagram', 'REELS', 'Institucional', 'Bastidores do processo e apresentação da equipe.', 'Áudio em alta'],
    ['19/10/2026', 'Manhã', 'A fazer', 'Instagram / Shorts', 'VÍDEO', 'Prova Social', 'Depoimento curto com cliente relatando a experiência e resultados.', 'Legenda animada'],
    ['26/10/2026', 'Noite', 'A fazer', 'Instagram', 'REELS', 'Comercial', 'Oferta do mês com CTA direto para direct/link da bio.', 'Foco em conversão'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];

  const wsVideos = XLSX.utils.aoa_to_sheet([...videoHeaders, ...sampleVideos]);
  wsVideos['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  wsVideos['!cols'] = wsGeral['!cols'];
  XLSX.utils.book_append_sheet(wb, wsVideos, '🎬 Vídeos');

  // 3. ABA ARTES & DESIGN
  const artHeaders = [
    ['Cronograma de Artes (Carrosséis / Posts / Stories / Banners)'],
    [`MÊS: ${monthName.toUpperCase()} — CLIENTE: ${clientName.toUpperCase()}`],
    ['Data', 'Turno', 'Status', 'Canal', 'Formato', 'Objetivo', 'Direcionamento / Copy & Layout', 'Obs.']
  ];

  const sampleArts = [
    ['05/10/2026', 'Manhã', 'Em revisão', 'Instagram', 'STORIES', 'Institucional', 'Sequência de 4 stories apresentando os diferenciais da marca.', 'Sticker interativo'],
    ['10/10/2026', 'Tarde', 'Programado', 'Instagram', 'CARD', 'Serviço', 'Post único 4:5 destacando os benefícios do serviço.', 'Cores oficiais'],
    ['15/10/2026', 'Tarde', 'A fazer', 'Instagram', 'CARROSSEL', 'Educativo', 'Carrossel de 5 slides com conteúdo de alto valor para salvar.', 'Slide final com CTA'],
    ['22/10/2026', 'Manhã', 'A fazer', 'Instagram', 'POST', 'Comercial', 'Post promocional com escassez.', 'Contraste forte'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];

  const wsArts = XLSX.utils.aoa_to_sheet([...artHeaders, ...sampleArts]);
  wsArts['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  wsArts['!cols'] = wsGeral['!cols'];
  XLSX.utils.book_append_sheet(wb, wsArts, '🎨 Artes');

  // 4. ABA OPÇÕES & GUIA (Valores recomendados para os selects)
  const optionsGuide = [
    ['GUIA DE OPÇÕES PARA O SOCIAL MEDIA'],
    [],
    ['TURNO:', 'Manhã', 'Tarde', 'Noite'],
    ['STATUS:', 'Em criação', 'Em revisão', 'Programado', 'Publicado', 'A fazer'],
    ['CANAL:', 'Instagram', 'TikTok', 'YouTube', 'Linkedin', 'Facebook', 'Threads'],
    ['FORMATO:', 'STORIES', 'CARD', 'VÍDEO', 'REELS', 'CARROSSEL', 'SHORTS'],
    ['OBJETIVO:', 'Institucional', 'Serviço', 'Produto', 'Educativo', 'Topo de Funil', 'Conversão', 'Prova Social'],
    [],
    ['COMO IMPORTAR NA PLATAFORMA:'],
    ['1. Preencha as linhas na aba "📅 Cronograma Mensal" (ou nas abas de Vídeos e Artes).'],
    ['2. Salve o arquivo no Excel / Google Sheets.'],
    ['3. Acesse /planejamento-pdf e solte o arquivo na área de upload.'],
    ['4. A plataforma lerá as colunas de Data, Turno, Formato, Canal e Direcionamento criando todos os cards no Kanban!'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(optionsGuide);
  wsGuide['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'ℹ️ Guia de Preenchimento');

  const cleanClient = options?.clientName ? options.clientName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'cliente';
  const fileName = `cronograma-postagens-${cleanClient}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

