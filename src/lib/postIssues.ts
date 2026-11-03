import type { Client, Task, TeamMember } from '@/types/agency';
import type { ClientReview } from '@/lib/clientApprovals';

/**
 * Erros nos posts para o Meu dia: só posts que ainda vão sair (data de postar de hoje em diante).
 * Os problemas vão para o social media do cliente: o Responsável do cliente cujo cargo (Equipe → Funcionários)
 * tem "social"; sem nenhum, a pessoa da tarefa com esse cargo. Post sem social media fica de fora.
 */
export type IssueKind =
  | 'early_stage' | 'no_caption' | 'approved_not_scheduled' | 'not_approved' | 'change_pending'
  | 'caption_problem' | 'no_time' | 'due_after_post' | 'same_slot' | 'no_client';

export const ISSUES: Record<IssueKind, { label: string; severity: 1 | 2 | 3 }> = {
  early_stage: { label: 'Atrasado na produção', severity: 3 },
  no_caption: { label: 'Sem legenda', severity: 3 },
  approved_not_scheduled: { label: 'Aprovado e não agendado', severity: 3 },
  not_approved: { label: 'Cliente ainda não aprovou', severity: 2 },
  change_pending: { label: 'Ajuste do cliente pendente', severity: 2 },
  caption_problem: { label: 'Legenda com problema', severity: 2 },
  due_after_post: { label: 'Entrega depois da postagem', severity: 2 },
  no_time: { label: 'Sem horário de postar', severity: 1 },
  same_slot: { label: 'Dois posts no mesmo horário', severity: 1 },
  no_client: { label: 'Sem cliente', severity: 1 },
};

export type PostIssue = { kind: IssueKind; detail?: string };
export type FlaggedPost = { task: Task; owner: string; issues: PostIssue[] };

const DONE = /postado|publicado|conclu|programado/i;
/** Etapas em que o post ainda nem foi gravado/escrito */
const EARLY = /a fazer|para fazer|copy|capta|pré|pre -|pre-|produ|dire|grava/i;
const PLACEHOLDER = /lorem|xxx|legenda aqui|inserir|\[[^\]]*\]|\{[^}]*\}|a definir/i;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (day: string, n: number) => { const [y, m, d] = day.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const hasText = (s?: string) => /[\p{L}\p{N}]{2,}/u.test(s ?? '');

export function captionProblems(caption: string): string[] {
  const out: string[] = [];
  if (caption.length > 2200) out.push(`${caption.length} caracteres (o Instagram aceita 2.200)`);
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (tags.length > 30) out.push(`${tags.length} hashtags (o Instagram aceita 30)`);
  const dup = tags.map((t) => t.toLowerCase()).filter((t, i, a) => a.indexOf(t) !== i);
  if (dup.length) out.push(`hashtag repetida: ${[...new Set(dup)].slice(0, 3).join(' ')}`);
  const ph = caption.match(PLACEHOLDER);
  if (ph) out.push(`texto provisório: "${ph[0].slice(0, 30)}"`);
  return out;
}

export function findPostIssues(
  tasks: Task[], clients: Client[], reviews: Record<string, ClientReview>, team: TeamMember[], today = iso(new Date()),
): FlaggedPost[] {
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const socialMedia = new Map(team.filter((m) => /social/i.test(m.role)).map((m) => [m.name.trim().toLowerCase(), m.name.trim()]));
  const socialOf = (names: (string | undefined)[]) => names.map((n) => socialMedia.get((n ?? '').trim().toLowerCase())).find(Boolean);
  const open = tasks.filter((t) => !t.deletedAt && t.postDate && !DONE.test(t.status)
    && t.postDate >= today && t.postDate <= shift(today, 30));
  // Mesmo cliente, mesmo dia e mesmo horário
  const slotCount = new Map<string, number>();
  open.forEach((t) => { if (t.postTime) { const k = `${t.clientId}|${t.postDate}|${t.postTime.slice(0, 5)}`; slotCount.set(k, (slotCount.get(k) ?? 0) + 1); } });

  const out: FlaggedPost[] = [];
  for (const t of open) {
    const post = t.postDate!;
    const r = reviews[t.id];
    const issues: PostIssue[] = [];
    if (post <= shift(today, 2) && EARLY.test(t.status)) issues.push({ kind: 'early_stage', detail: `posta em até 2 dias e está em ${t.status}` });
    if (post <= shift(today, 3) && !hasText(t.caption)) issues.push({ kind: 'no_caption' });
    if (r?.changeRequested) issues.push({ kind: 'change_pending' });
    else if (r?.approved && !r.scheduled && post <= shift(today, 1)) issues.push({ kind: 'approved_not_scheduled' });
    else if (!r?.approved && post <= shift(today, 2) && !EARLY.test(t.status)) issues.push({ kind: 'not_approved' });
    if (hasText(t.caption)) {
      const p = captionProblems(t.caption!);
      if (p.length) issues.push({ kind: 'caption_problem', detail: p.join('; ') });
    }
    if (t.dueDate && t.dueDate > post) issues.push({ kind: 'due_after_post' });
    if (!t.postTime) issues.push({ kind: 'no_time' });
    else if ((slotCount.get(`${t.clientId}|${post}|${t.postTime.slice(0, 5)}`) ?? 0) > 1) issues.push({ kind: 'same_slot', detail: `${t.postTime.slice(0, 5)}` });
    if (!t.clientId || !byClient.has(t.clientId)) issues.push({ kind: 'no_client' });
    const managers = (t.clientId && byClient.get(t.clientId)?.accountManager) || [];
    const owner = socialOf(managers) || socialOf([t.assignee, t.copywriter]);
    if (!issues.length || !owner) continue;
    issues.sort((a, b) => ISSUES[b.kind].severity - ISSUES[a.kind].severity);
    out.push({ task: t, owner, issues });
  }
  return out.sort((a, b) => a.task.postDate!.localeCompare(b.task.postDate!));
}

/** Pontos por pessoa: erro grave vale 3, médio 2, leve 1 */
export function scoreByOwner(posts: FlaggedPost[]) {
  const map = new Map<string, { owner: string; points: number; posts: FlaggedPost[]; kinds: Partial<Record<IssueKind, number>> }>();
  for (const p of posts) {
    const cur = map.get(p.owner) ?? { owner: p.owner, points: 0, posts: [], kinds: {} };
    cur.posts.push(p);
    for (const i of p.issues) { cur.points += ISSUES[i.kind].severity; cur.kinds[i.kind] = (cur.kinds[i.kind] ?? 0) + 1; }
    map.set(p.owner, cur);
  }
  return [...map.values()].sort((a, b) => b.points - a.points);
}
