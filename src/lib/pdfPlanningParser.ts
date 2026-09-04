import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type PlanningItemType = 'video' | 'arte';

export interface PlanningItem {
  id: string;
  title: string;
  date: string;
  type: PlanningItemType;
  description: string;
  rawText: string;
}

const VIDEO_KEYWORDS = [
  'video', 'vídeo', 'reel', 'reels', 'tiktok', 'youtube', 'shorts',
  'gravacao', 'gravação', 'roteiro', 'cena', 'filmagem', 'edicao', 'edição',
  'loop', 'viral', 'trending',
];

const ART_KEYWORDS = [
  'arte', 'post', 'posts', 'carrossel', 'carousel', 'story', 'stories',
  'feed', 'ilha', 'banner', 'thumb', 'thumbnail', 'capa', 'grafico',
  'gráfico', 'design', 'layout', 'imagem', 'foto', 'fotografia',
  'infografico', 'infográfico', 'mockup',
];

const DATE_PATTERNS = [
  /(\d{1,2})\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:eiro|eiro|ilho|eiro|o|ho|embro|embro|embro|embro|embro)?(?:\s*(?:de\s*)?(\d{4}))?/gi,
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g,
  /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s*(?:de\s*)?(\d{4}))?/gi,
  /(segunda|terça|quarta|quinta|sexta|sabado|sábado|domingo)(?:\s*-feira)?(?:\s*,?\s*(\d{1,2})(?:\s*de\s+)?(\w+)(?:\s*de\s+(\d{4}))?)?/gi,
];

const MONTH_MAP: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4,
  junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9,
  novembro: 10, dezembro: 11,
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

function parseDateFromText(text: string): string | null {
  const lower = text.toLowerCase();

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(lower);
    if (match) {
      let year = new Date().getFullYear();
      let month = 0;
      let day = 1;

      if (match[0].includes('/') || match[0].includes('-') || match[0].includes('.')) {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : year;
      } else if (MONTH_MAP[match[2]?.toLowerCase()]) {
        day = parseInt(match[1]);
        month = MONTH_MAP[match[2].toLowerCase()];
        if (match[3]) year = parseInt(match[3]);
      } else if (MONTH_MAP[match[1]?.toLowerCase()]) {
        month = MONTH_MAP[match[1].toLowerCase()];
        if (match[2]) day = parseInt(match[2]);
        if (match[3]) year = parseInt(match[3]);
      }

      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        const d = new Date(year, month, day);
        return d.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function classifyType(text: string): PlanningItemType {
  const lower = text.toLowerCase();
  const videoScore = VIDEO_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
  const artScore = ART_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
  return artScore > videoScore ? 'arte' : 'video';
}

function extractTitle(line: string): string {
  let title = line
    .replace(/^[\d\.\-\*•]+[\s\)]]*/, '')
    .replace(/^dia\s*\d+\s*[:\-—]?\s*/i, '')
    .replace(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{0,4}\s*[:\-—]?\s*/i, '')
    .trim();

  if (title.length > 80) title = title.substring(0, 77) + '...';
  return title || 'Item sem título';
}

function groupLinesIntoItems(lines: string[]): string[] {
  const items: string[] = [];
  let current = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) items.push(current);
      current = '';
      continue;
    }

    const hasDate = parseDateFromText(trimmed) !== null;
    const isBullet = /^[\d\.\-\*•]/.test(trimmed);
    const isSeparator = /^[-=_]{3,}$/.test(trimmed);

    if ((hasDate || isBullet || isSeparator) && current) {
      items.push(current);
      current = trimmed;
    } else {
      current = current ? current + '\n' + trimmed : trimmed;
    }
  }
  if (current) items.push(current);
  return items;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

export function parsePlanningFromText(rawText: string): PlanningItem[] {
  const lines = rawText.split(/\n/).filter(l => l.trim());
  const groups = groupLinesIntoItems(lines);
  const items: PlanningItem[] = [];

  for (const group of groups) {
    const date = parseDateFromText(group);
    const type = classifyType(group);
    const title = extractTitle(group.split('\n')[0]);

    const description = group
      .split('\n')
      .slice(1)
      .join('\n')
      .trim();

    items.push({
      id: crypto.randomUUID(),
      title,
      date: date || '',
      type,
      description,
      rawText: group,
    });
  }

  return items;
}

import * as XLSX from 'xlsx';

export async function parsePlanningExcel(file: File): Promise<PlanningItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const items: PlanningItem[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!data || data.length === 0) continue;

    // Detecta se a aba é voltada a vídeos ou artes pelo nome da aba
    const lowerSheet = sheetName.toLowerCase();
    const sheetDefaultType: PlanningItemType = lowerSheet.includes('arte') || lowerSheet.includes('post') || lowerSheet.includes('design') 
      ? 'arte' 
      : 'video';

    // Localiza a linha de cabeçalho
    let headerRowIdx = -1;
    let colIdxMap: { type?: number; date?: number; turno?: number; status?: number; canal?: number; format?: number; objetivo?: number; title?: number; desc?: number; obs?: number } = {};

    for (let r = 0; r < Math.min(data.length, 10); r++) {
      const row = data[r].map(c => String(c).toLowerCase().trim());
      const hasDate = row.some(c => c.includes('data') || c.includes('dia'));
      const hasDirecionamento = row.some(c => c.includes('direcionamento') || c.includes('título') || c.includes('titulo') || c.includes('conteúdo') || c.includes('tema'));
      
      if (hasDate || hasDirecionamento) {
        headerRowIdx = r;
        row.forEach((cell, idx) => {
          if (cell.includes('tipo')) colIdxMap.type = idx;
          if (cell.includes('data') || cell.includes('dia')) colIdxMap.date = idx;
          if (cell.includes('turno')) colIdxMap.turno = idx;
          if (cell.includes('status')) colIdxMap.status = idx;
          if (cell.includes('canal') || cell.includes('rede') || cell.includes('plataforma')) colIdxMap.canal = idx;
          if (cell.includes('formato')) colIdxMap.format = idx;
          if (cell.includes('objetivo') || cell.includes('pilar')) colIdxMap.objetivo = idx;
          if (cell.includes('direcionamento') || cell.includes('título') || cell.includes('titulo') || cell.includes('tema') || cell.includes('conteúdo') || cell.includes('roteiro') || cell.includes('legenda')) {
            colIdxMap.title = idx;
            colIdxMap.desc = idx;
          }
          if (cell.includes('obs') || cell.includes('observa')) colIdxMap.obs = idx;
        });
        break;
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      // Extrai campos principais
      const rawTextContent = colIdxMap.title !== undefined ? String(row[colIdxMap.title] || '').trim() : (String(row[6] || row[2] || row[1] || row[0] || '').trim());
      
      // Ignora linhas de cabeçalho ou instruções vazias
      if (!rawTextContent || rawTextContent.toLowerCase().includes('cronograma de postagens') || rawTextContent.toLowerCase().includes('mês de referência') || rawTextContent.toLowerCase().includes('guia de opções') || rawTextContent.length < 2) {
        continue;
      }

      const rawType = colIdxMap.type !== undefined ? String(row[colIdxMap.type] || '').trim() : '';
      const rawDate = colIdxMap.date !== undefined ? String(row[colIdxMap.date] || '').trim() : '';
      const rawTurno = colIdxMap.turno !== undefined ? String(row[colIdxMap.turno] || '').trim() : '';
      const rawStatus = colIdxMap.status !== undefined ? String(row[colIdxMap.status] || '').trim() : '';
      const rawCanal = colIdxMap.canal !== undefined ? String(row[colIdxMap.canal] || '').trim() : '';
      const rawFormat = colIdxMap.format !== undefined ? String(row[colIdxMap.format] || '').trim() : '';
      const rawObjetivo = colIdxMap.objetivo !== undefined ? String(row[colIdxMap.objetivo] || '').trim() : '';
      const rawObs = colIdxMap.obs !== undefined ? String(row[colIdxMap.obs] || '').trim() : '';

      // Título resumido (primeiras palavras ou linha)
      let title = rawTextContent;
      if (title.length > 70) {
        title = title.substring(0, 67) + '...';
      }

      // Classifica se é Vídeo ou Arte com base no formato/canal/tipo
      const fullContext = `${rawType} ${rawFormat} ${rawCanal} ${sheetName} ${rawTextContent}`.toLowerCase();
      let itemType: PlanningItemType = sheetDefaultType;
      if (fullContext.includes('reels') || fullContext.includes('vídeo') || fullContext.includes('video') || fullContext.includes('tiktok') || fullContext.includes('shorts')) {
        itemType = 'video';
      } else if (fullContext.includes('card') || fullContext.includes('post') || fullContext.includes('carrossel') || fullContext.includes('arte') || fullContext.includes('stories') || fullContext.includes('story')) {
        itemType = 'arte';
      } else {
        itemType = classifyType(fullContext);
      }

      // Converte data
      let dateIso = '';
      if (rawDate) {
        // Verifica se é número serial de data do Excel
        const num = Number(rawDate);
        if (!isNaN(num) && num > 20000 && num < 60000) {
          const excelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
          dateIso = excelDate.toISOString().split('T')[0];
        } else {
          // Limpa dias da semana como "QUA (08/10)"
          const cleanedDate = rawDate.replace(/^[A-Za-zÀ-ÖØ-öø-ÿ]{3,}\s*\(/, '').replace(/\)$/, '').trim();
          dateIso = parseDateFromText(cleanedDate) || parseDateFromText(rawDate) || '';
        }
      }

      // Monta descrição estruturada com os metadados do social media
      const descParts: string[] = [];
      if (rawCanal) descParts.push(`📱 **Canal**: ${rawCanal}`);
      if (rawFormat) descParts.push(`📐 **Formato**: ${rawFormat}`);
      if (rawTurno) descParts.push(`⏰ **Turno**: ${rawTurno}`);
      if (rawObjetivo) descParts.push(`🎯 **Objetivo**: ${rawObjetivo}`);
      if (rawStatus) descParts.push(`📊 **Status Planejado**: ${rawStatus}`);
      descParts.push(`📝 **Direcionamento / Briefing**:\n${rawTextContent}`);
      if (rawObs) descParts.push(`💬 **Obs**: ${rawObs}`);

      items.push({
        id: crypto.randomUUID(),
        title: title,
        date: dateIso,
        type: itemType,
        description: descParts.join('\n\n'),
        rawText: row.join(' | '),
      });
    }
  }

  return items;
}

export async function parsePlanningPdf(file: File): Promise<PlanningItem[]> {
  const rawText = await extractTextFromPdf(file);
  return parsePlanningFromText(rawText);
}

export async function parsePlanningFile(file: File): Promise<PlanningItem[]> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parsePlanningExcel(file);
  }
  return parsePlanningPdf(file);
}

