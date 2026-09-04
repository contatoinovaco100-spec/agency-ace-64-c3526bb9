import jsPDF from 'jspdf';

const COLORS = {
  black: [10, 10, 10] as [number, number, number],
  primary: [191, 247, 32] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray: [120, 120, 120] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  darkGray: [30, 30, 30] as [number, number, number],
  mediumGray: [50, 50, 50] as [number, number, number],
};

interface TemplateRow {
  data: string;
  tipo: string;
  titulo: string;
  descricao: string;
}

function drawHeader(doc: jsPDF, pageW: number) {
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 30, pageW, 2, 'F');

  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PLANEJAMENTO DE CONTEÚDO', 18, 16);

  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('INOVA Co. — Marketing & Audiovisual', 18, 24);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    pageW - 18,
    16,
    { align: 'right' }
  );
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, pageW: number): number {
  doc.setFillColor(...COLORS.darkGray);
  doc.roundedRect(18, y, pageW - 36, 10, 1, 1, 'F');

  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 24, y + 7);

  return y + 16;
}

function drawTableHeader(doc: jsPDF, y: number, pageW: number): number {
  const cols = [18, 42, 72, 112];
  const headers = ['DATA', 'TIPO', 'TÍTULO', 'DESCRIÇÃO / OBS'];

  doc.setFillColor(...COLORS.mediumGray);
  doc.rect(18, y, pageW - 36, 8, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  headers.forEach((h, i) => {
    doc.text(h, cols[i], y + 5.5);
  });

  return y + 10;
}

function drawRow(doc: jsPDF, y: number, row: TemplateRow, pageW: number, alt: boolean): number {
  if (alt) {
    doc.setFillColor(20, 20, 20);
    doc.rect(18, y, pageW - 36, 12, 'F');
  }

  const cols = [20, 44, 74, 114];
  doc.setTextColor(...COLORS.lightGray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  doc.text(row.data, cols[0], y + 5);
  doc.text(row.tipo, cols[1], y + 5);

  const titleLines = doc.splitTextToSize(row.titulo, 36);
  doc.text(titleLines[0] || '', cols[2], y + 5);

  const descLines = doc.splitTextToSize(row.descricao, pageW - 114 - 18);
  doc.text(descLines[0] || '', cols[3], y + 5);

  doc.setDrawColor(...COLORS.darkGray);
  doc.line(18, y + 12, pageW - 18, y + 12);

  return y + 12;
}

function drawEmptyRows(doc: jsPDF, startY: number, count: number, pageW: number): number {
  let y = startY;
  const cols = [20, 44, 74, 114];
  const emptyRow: TemplateRow = { data: '', tipo: '', titulo: '', descricao: '' };

  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      doc.setFillColor(20, 20, 20);
      doc.rect(18, y, pageW - 36, 12, 'F');
    }

    doc.setDrawColor(60, 60, 60);
    doc.line(18, y + 12, pageW - 18, y + 12);
    doc.line(42, y, 42, y + 12);
    doc.line(72, y, 72, y + 12);
    doc.line(112, y, 112, y + 12);

    y += 12;
  }
  return y;
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number) {
  const footerY = pageH - 12;
  doc.setDrawColor(60, 60, 60);
  doc.line(18, footerY - 4, pageW - 18, footerY - 4);

  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('INOVA Co. — Planejamento de Conteúdo', 18, footerY);
  doc.text('Preencha as colunas acima e faça upload na plataforma', pageW - 18, footerY, { align: 'right' });
}

export interface PdfTemplateOptions {
  clientName?: string;
  monthName?: string;
  rows?: TemplateRow[];
}

export function generatePlanningTemplate(options?: PdfTemplateOptions | TemplateRow[]) {
  const opts: PdfTemplateOptions = Array.isArray(options) 
    ? { rows: options } 
    : (options || {});

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const clientText = opts.clientName ? `CLIENTE: ${opts.clientName.toUpperCase()}` : 'INOVA Co. — Marketing & Audiovisual';
  const monthText = opts.monthName ? `MÊS: ${opts.monthName.toUpperCase()}` : `Gerado em ${new Date().toLocaleDateString('pt-BR')}`;

  // Header
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 30, pageW, 2, 'F');

  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PLANEJAMENTO MENSAL DE CONTEÚDO', 18, 15);

  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(clientText, 18, 23);

  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(monthText, pageW - 18, 23, { align: 'right' });

  const rows = opts.rows;

  // Videos section
  let y = 42;
  y = drawSectionTitle(doc, y, '🎬 SEÇÃO 1: PRODUÇÃO DE VÍDEOS (REELS / TIKTOK / SHORTS)', pageW);
  y = drawTableHeader(doc, y, pageW);

  if (rows && rows.length > 0) {
    const videoRows = rows.filter(r => r.tipo.toLowerCase().includes('video') || r.tipo.toLowerCase().includes('vídeo'));
    if (videoRows.length > 0) {
      videoRows.forEach((r, i) => {
        y = drawRow(doc, y, r, pageW, i % 2 === 0);
      });
    } else {
      y = drawEmptyRows(doc, y, 6, pageW);
    }
  } else {
    y = drawEmptyRows(doc, y, 6, pageW);
  }

  // Arts section
  y += 8;
  y = drawSectionTitle(doc, y, '🎨 SEÇÃO 2: ARTES & DESIGN (CARROSSEIS / POSTS / STORIES)', pageW);
  y = drawTableHeader(doc, y, pageW);

  if (rows && rows.length > 0) {
    const artRows = rows.filter(r => r.tipo.toLowerCase().includes('arte') || r.tipo.toLowerCase().includes('post') || r.tipo.toLowerCase().includes('carrossel'));
    if (artRows.length > 0) {
      artRows.forEach((r, i) => {
        y = drawRow(doc, y, r, pageW, i % 2 === 0);
      });
    } else {
      y = drawEmptyRows(doc, y, 6, pageW);
    }
  } else {
    y = drawEmptyRows(doc, y, 6, pageW);
  }

  // Instructions box
  y += 8;
  if (y + 30 < pageH - 20) {
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(18, y, pageW - 36, 24, 2, 2, 'F');
    doc.setDrawColor(...COLORS.primary);
    doc.roundedRect(18, y, pageW - 36, 24, 2, 2, 'S');

    doc.setTextColor(...COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('COMO USAR NO FLUXO MENSAL:', 24, y + 7);

    doc.setTextColor(...COLORS.lightGray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('1. Preencha as datas, títulos e descrições na tabela mensal acima ou na planilha Excel.', 24, y + 13);
    doc.text('2. Faça upload do arquivo em PDF ou XLSX na plataforma em /planejamento-pdf.', 24, y + 18);
    doc.text('3. Todos os cards de vídeos e artes serão criados automaticamente no Kanban do cliente.', 24, y + 23);
  }

  drawFooter(doc, pageW, pageH);

  const cleanClient = opts.clientName ? opts.clientName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'cliente';
  doc.save(`planejamento-mensal-${cleanClient}.pdf`);
}
