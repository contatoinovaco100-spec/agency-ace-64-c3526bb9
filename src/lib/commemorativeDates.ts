// Datas comemorativas do Brasil que rendem conteúdo, para o planejamento.
// "major" são as grandes datas de varejo/campanha (aparecem destacadas e com aviso de antecedência).

export type CommemorativeDate = { date: string; name: string; major: boolean };

/** Dia e mês fixos: [MM-DD, nome, grande data?] */
const FIXED: [string, string, boolean][] = [
  ['01-01', 'Ano Novo', true],
  ['03-08', 'Dia Internacional da Mulher', true],
  ['03-15', 'Dia do Consumidor', true],
  ['04-01', 'Dia da Mentira', false],
  ['04-21', 'Tiradentes', false],
  ['05-01', 'Dia do Trabalhador', false],
  ['06-05', 'Dia do Meio Ambiente', false],
  ['06-12', 'Dia dos Namorados', true],
  ['06-24', 'São João', false],
  ['07-20', 'Dia do Amigo', false],
  ['07-26', 'Dia dos Avós', false],
  ['09-01', 'Setembro Amarelo', false],
  ['09-07', 'Independência do Brasil', false],
  ['09-15', 'Dia do Cliente', true],
  ['10-01', 'Outubro Rosa', false],
  ['10-05', 'Dia do Empreendedor', false],
  ['10-12', 'Dia das Crianças', true],
  ['10-15', 'Dia do Professor', false],
  ['10-31', 'Halloween', false],
  ['11-01', 'Novembro Azul', false],
  ['11-02', 'Finados', false],
  ['11-15', 'Proclamação da República', false],
  ['11-20', 'Consciência Negra', false],
  ['12-25', 'Natal', true],
  ['12-31', 'Réveillon', false],
];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Domingo de Páscoa (algoritmo de Meeus/Butcher) */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}

/** n-ésimo dia da semana do mês (weekday: 0 = domingo) */
function nthWeekday(y: number, month: number, weekday: number, n: number) {
  const first = new Date(y, month, 1);
  return new Date(y, month, 1 + ((weekday - first.getDay() + 7) % 7) + 7 * (n - 1));
}

const cache = new Map<number, CommemorativeDate[]>();

export function commemorativeDatesOf(y: number): CommemorativeDate[] {
  if (cache.has(y)) return cache.get(y)!;
  const pascoa = easter(y);
  const blackFriday = addDays(nthWeekday(y, 10, 4, 4), 1); // dia seguinte à 4ª quinta de novembro
  const list: CommemorativeDate[] = [
    ...FIXED.map(([md, name, major]) => ({ date: `${y}-${md}`, name, major })),
    { date: iso(addDays(pascoa, -47)), name: 'Carnaval', major: true },
    { date: iso(addDays(pascoa, -2)), name: 'Sexta-feira Santa', major: false },
    { date: iso(pascoa), name: 'Páscoa', major: true },
    { date: iso(nthWeekday(y, 4, 0, 2)), name: 'Dia das Mães', major: true },
    { date: iso(nthWeekday(y, 7, 0, 2)), name: 'Dia dos Pais', major: true },
    { date: iso(blackFriday), name: 'Black Friday', major: true },
    { date: iso(addDays(blackFriday, 3)), name: 'Cyber Monday', major: false },
  ].sort((a, b) => a.date.localeCompare(b.date));
  cache.set(y, list);
  return list;
}

/** Datas entre from e to (YYYY-MM-DD, inclusive) */
export function commemorativeDatesBetween(from: string, to: string) {
  const out: CommemorativeDate[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    out.push(...commemorativeDatesOf(y).filter((d) => d.date >= from && d.date <= to));
  }
  return out;
}

/** Datas por dia, para pôr no calendário */
export function commemorativeByDay(from: string, to: string) {
  const map: Record<string, CommemorativeDate[]> = {};
  for (const d of commemorativeDatesBetween(from, to)) (map[d.date] ??= []).push(d);
  return map;
}

/** Dias entre hoje e a data (YYYY-MM-DD) */
export function daysUntil(date: string, today = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86_400_000);
}
