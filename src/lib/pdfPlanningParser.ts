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

export async function parsePlanningPdf(file: File): Promise<PlanningItem[]> {
  const rawText = await extractTextFromPdf(file);
  return parsePlanningFromText(rawText);
}
