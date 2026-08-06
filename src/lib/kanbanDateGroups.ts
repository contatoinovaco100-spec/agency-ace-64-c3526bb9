export function todaySP(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

export function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const str = s.trim();
  if (!str) return null;
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function formatFullDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function dateGroupMeta(dateStr: string, today: string): { label: string; subtitle: string } {
  const subtitle = formatFullDate(dateStr);
  if (dateStr === today) return { label: 'Hoje', subtitle };
  if (dateStr === addDays(today, 1)) return { label: 'Amanhã', subtitle };
  const wd = new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
  return { label: wd.charAt(0).toUpperCase() + wd.slice(1), subtitle };
}
