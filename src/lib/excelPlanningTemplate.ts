import * as XLSX from 'xlsx';
import type { PlanningItem, PlanningItemType } from './pdfPlanningParser';

export interface MonthlyPlanningExportOptions {
  clientName?: string;
  monthName?: string; // ex: "Outubro de 2026"
  year?: number;
}

export function generateMonthlyExcelTemplate(options?: MonthlyPlanningExportOptions) {
  const wb = XLSX.utils.book_new();

  const clientHeader = options?.clientName ? options.clientName.toUpperCase() : '[NOME DO CLIENTE]';
  const monthHeader = options?.monthName ? options.monthName.toUpperCase() : 'PLANEJAMENTO MENSAL';

  // 1. ABA VÍDEOS (Reels, TikTok, Shorts, Gravações)
  const videoHeaders = [
    ['INOVA CO. — PLANEJAMENTO MENSAL DE CONTEÚDO (VÍDEOS)'],
    [`CLIENTE: ${clientHeader}`, '', `MÊS/ANO: ${monthHeader}`, '', ''],
    [],
    ['TIPO', 'DATA', 'TÍTULO DO VÍDEO', 'FORMATO / PLATAFORMA', 'ROTEIRO / GANCHO / BRIEFING', 'STATUS', 'OBSERVAÇÕES']
  ];

  const sampleVideos = [
    ['Vídeo', '05/10/2026', 'Dica Rápida: 3 Erros Comuns', 'Reels / TikTok (9:16)', 'Gancho forte nos primeiros 3 segundos. Apresentar os 3 erros e CTA no final para direct.', 'A Fazer', 'Gravação externa'],
    ['Vídeo', '12/10/2026', 'Bastidores / Dia a Dia', 'Reels / Shorts (9:16)', 'Mostrar a rotina de atendimento e processo de qualidade.', 'A Fazer', 'Usar áudio em alta'],
    ['Vídeo', '19/10/2026', 'Depoimento / Prova Social', 'Reels (9:16)', 'Vídeo curto de cliente satisfeito compartilhando o resultado obtido.', 'A Fazer', 'Inserir legenda dinâmica'],
    ['Vídeo', '26/10/2026', 'Oferta Especial / Fechamento do Mês', 'Reels / Stories', 'Chamada comercial com escassez e link na bio.', 'A Fazer', 'Foco em conversão'],
    ['Vídeo', '', '', 'Reels', '', 'A Fazer', ''],
    ['Vídeo', '', '', 'Reels', '', 'A Fazer', ''],
    ['Vídeo', '', '', 'Reels', '', 'A Fazer', ''],
    ['Vídeo', '', '', 'Reels', '', 'A Fazer', ''],
  ];

  const wsVideos = XLSX.utils.aoa_to_sheet([...videoHeaders, ...sampleVideos]);

  // Largura das colunas na aba de vídeos
  wsVideos['!cols'] = [
    { wch: 12 }, // Tipo
    { wch: 14 }, // Data
    { wch: 35 }, // Título
    { wch: 24 }, // Formato/Plataforma
    { wch: 50 }, // Roteiro/Briefing
    { wch: 14 }, // Status
    { wch: 25 }, // Observações
  ];

  XLSX.utils.book_append_sheet(wb, wsVideos, '🎬 Vídeos');

  // 2. ABA ARTES (Posts, Carrosséis, Stories, Banners)
  const artHeaders = [
    ['INOVA CO. — PLANEJAMENTO MENSAL DE CONTEÚDO (ARTES & DESIGN)'],
    [`CLIENTE: ${clientHeader}`, '', `MÊS/ANO: ${monthHeader}`, '', ''],
    [],
    ['TIPO', 'DATA', 'TÍTULO DA ARTE', 'FORMATO / TIPO', 'TEXTO DA LEGENDA / COPY', 'STATUS', 'OBSERVAÇÕES VISUAIS']
  ];

  const sampleArts = [
    ['Arte', '03/10/2026', 'Post Institucional / Autoridade', 'Carrossel (4 slides)', 'Slide 1: Capa com pergunta instigante.\nSlide 2-3: Conteúdo educativo.\nSlide 4: Conclusão e salve o post.', 'A Fazer', 'Cores da marca'],
    ['Arte', '10/10/2026', 'Depoimento em Card Estilizado', 'Post Único (4:5)', 'Print estilizado com feedback positivo e legenda focando em resultado.', 'A Fazer', 'Design clean e minimalista'],
    ['Arte', '17/10/2026', 'Infográfico / Passo a Passo', 'Carrossel (5 slides)', 'Guia prático para o seguidor aplicar no negócio.', 'A Fazer', 'Ícones destacados'],
    ['Arte', '24/10/2026', 'Aviso Importante / Novidade', 'Post Único (4:5)', 'Anúncio de novo serviço/produto.', 'A Fazer', 'Contraste alto'],
    ['Arte', '', '', 'Post Feed', '', 'A Fazer', ''],
    ['Arte', '', '', 'Post Feed', '', 'A Fazer', ''],
    ['Arte', '', '', 'Carrossel', '', 'A Fazer', ''],
    ['Arte', '', '', 'Stories', '', 'A Fazer', ''],
  ];

  const wsArts = XLSX.utils.aoa_to_sheet([...artHeaders, ...sampleArts]);

  wsArts['!cols'] = [
    { wch: 12 }, // Tipo
    { wch: 14 }, // Data
    { wch: 35 }, // Título
    { wch: 24 }, // Formato
    { wch: 50 }, // Copy/Legenda
    { wch: 14 }, // Status
    { wch: 25 }, // Obs
  ];

  XLSX.utils.book_append_sheet(wb, wsArts, '🎨 Artes');

  // 3. ABA RESUMO MENSAL / INSTRUÇÕES
  const instructions = [
    ['INSTRUÇÕES DE PREENCHIMENTO DO PLANEJAMENTO MENSAL'],
    [],
    ['COMO USAR ESTA PLANILHA NO EXCEL:'],
    ['1. Preencha as abas "🎬 Vídeos" e "🎨 Artes" com as demandas do mês do cliente.'],
    ['2. Você pode preencher as colunas DATA no formato DD/MM/AAAA (ex: 15/10/2026) ou AAAA-MM-DD.'],
    ['3. A coluna TIPO aceita "Vídeo", "Reels", "TikTok", "Arte", "Post", "Carrossel", etc.'],
    ['4. A coluna TÍTULO será o título do card gerado no Kanban da plataforma.'],
    ['5. A coluna ROTEIRO / LEGENDA será importada como a descrição/briefing do card.'],
    ['6. Ao terminar, salve a planilha como .XLSX ou .PDF e suba na plataforma em /planejamento-pdf.'],
    ['7. Todos os cards serão gerados e vinculados automaticamente ao Kanban do cliente!'],
    [],
    ['DICAS IMPORTANTES:'],
    ['• Mantenha as colunas na ordem original para uma importação precisa.'],
    ['• Você pode adicionar quantas linhas forem necessárias para o mês.'],
    ['• As linhas em branco serão ignoradas automaticamente pelo importador.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'ℹ️ Instruções');

  const cleanClient = options?.clientName ? options.clientName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'cliente';
  const fileName = `planejamento-mensal-${cleanClient}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
