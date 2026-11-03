import type { Client, Task, TeamMember } from '@/types/agency';

/** Quem aparece nos Erros nos posts quando o admin ainda não escolheu: cargo com "social" */
export const defaultTrackedPeople = (team: TeamMember[]) => team.filter((m) => /social/i.test(m.role)).map((m) => m.name.trim());
import type { ClientReview } from '@/lib/clientApprovals';

/**
 * Erros nos posts para o Meu dia: só posts que ainda vão sair (data de postar de hoje em diante).
 * Os problemas vão para uma das pessoas acompanhadas (`people`): primeiro o Responsável do cliente,
 * depois quem está em algum papel da tarefa. Post sem nenhuma delas fica de fora.
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
/** Etapas em que o conteúdo está pronto esperando o cliente (as mesmas do lembrete de aprovação) */
const IN_APPROVAL = /revis|finaliz|aprova/i;
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

/** Nome sem acento, minúsculo, com z = s (Petruz = Petrus) */
const normName = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/z/g, 's').replace(/\s+/g, ' ').trim();

/**
 * Acha a pessoa acompanhada pelo nome escrito no cliente ou na tarefa. Aceita o nome completo ou só o primeiro
 * nome (quando nenhuma outra pessoa acompanhada tem o mesmo primeiro nome): "Petrus Delgado" acha "Petruz".
 */
export function personMatcher(people: string[]) {
  const full = new Map(people.map((n) => [normName(n), n.trim()]));
  const firstCount = new Map<string, number>();
  people.forEach((n) => { const f = normName(n).split(' ')[0]; firstCount.set(f, (firstCount.get(f) ?? 0) + 1); });
  const byFirst = new Map(people.filter((n) => firstCount.get(normName(n).split(' ')[0]) === 1).map((n) => [normName(n).split(' ')[0], n.trim()]));
  const one = (raw?: string) => {
    const k = normName(raw ?? '');
    if (!k) return undefined;
    return full.get(k) ?? byFirst.get(k.split(' ')[0]);
  };
  return (names: (string | undefined)[]) => names.map(one).find(Boolean);
}

export function findPostIssues(
  tasks: Task[], clients: Client[], reviews: Record<string, ClientReview>, people: string[], today = iso(new Date()),
): FlaggedPost[] {
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const trackedOf = personMatcher(people);
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
    // Só cobra aprovação do que já está pronto e na etapa de aprovação (o que o cliente vê no link)
    else if (!r?.approved && post <= shift(today, 2) && IN_APPROVAL.test(t.status)) issues.push({ kind: 'not_approved' });
    if (hasText(t.caption)) {
      const p = captionProblems(t.caption!);
      if (p.length) issues.push({ kind: 'caption_problem', detail: p.join('; ') });
    }
    if (t.dueDate && t.dueDate > post) issues.push({ kind: 'due_after_post' });
    if (!t.postTime) issues.push({ kind: 'no_time' });
    else if ((slotCount.get(`${t.clientId}|${post}|${t.postTime.slice(0, 5)}`) ?? 0) > 1) issues.push({ kind: 'same_slot', detail: `${t.postTime.slice(0, 5)}` });
    if (!t.clientId || !byClient.has(t.clientId)) issues.push({ kind: 'no_client' });
    const managers = (t.clientId && byClient.get(t.clientId)?.accountManager) || [];
    const owner = trackedOf(managers) || trackedOf([t.assignee, t.copywriter, t.editor, t.director, t.videomaker, t.scriptWriter, t.decupador]);
    if (!issues.length || !owner) continue;
    issues.sort((a, b) => ISSUES[b.kind].severity - ISSUES[a.kind].severity);
    out.push({ task: t, owner, issues });
  }
  return out.sort((a, b) => a.task.postDate!.localeCompare(b.task.postDate!));
}

/** Pontos por pessoa: erro grave vale 3, médio 2, leve 1 */
export function scoreByOwner(posts: FlaggedPost[], people: string[] = []) {
  const map = new Map<string, { owner: string; points: number; posts: FlaggedPost[]; kinds: Partial<Record<IssueKind, number>> }>();
  // Pessoas fixadas aparecem mesmo sem erro
  people.forEach((n) => map.set(n.trim(), { owner: n.trim(), points: 0, posts: [], kinds: {} }));
  for (const p of posts) {
    const cur = map.get(p.owner) ?? { owner: p.owner, points: 0, posts: [], kinds: {} };
    cur.posts.push(p);
    for (const i of p.issues) { cur.points += ISSUES[i.kind].severity; cur.kinds[i.kind] = (cur.kinds[i.kind] ?? 0) + 1; }
    map.set(p.owner, cur);
  }
  return [...map.values()].sort((a, b) => b.points - a.points || a.owner.localeCompare(b.owner));
}

/** O que fazer para resolver cada erro (vai na mensagem de WhatsApp) */
export const ISSUE_FIX: Record<IssueKind, string> = {
  early_stage: 'acelerar a produção ou mudar a data de postar',
  no_caption: 'escrever a legenda',
  approved_not_scheduled: 'agendar o post',
  not_approved: 'cobrar a aprovação do cliente',
  change_pending: 'fazer o ajuste que o cliente pediu',
  caption_problem: 'corrigir a legenda',
  due_after_post: 'ajustar a data de entrega para antes da postagem',
  no_time: 'colocar o horário de postar',
  same_slot: 'mudar o horário de um dos posts',
  no_client: 'vincular o cliente no card',
};

/** Mensagem de WhatsApp para o social media com cada post, o que arrumar e o link do card */
export function issuesMessage(owner: string, posts: FlaggedPost[], clientName: Record<string, string>, origin: string) {
  const first = owner.split(/\s+/)[0];
  const when = (t: Task) => {
    const [y, m, d] = t.postDate!.split('-').map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return `${wd} ${pad(d)}/${pad(m)}${t.postTime ? ` às ${t.postTime.slice(0, 5)}` : ''}`;
  };
  const blocks = posts.map((p, i) => {
    const t = p.task;
    const name = (t.videoName || t.title || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
    const link = `${origin}${t.taskType === 'Arte' ? '/artes' : '/tarefas'}?taskId=${t.id}`;
    const lines = p.issues.map((x) => `• ${ISSUES[x.kind].label}${x.detail ? ` (${x.detail})` : ''} → ${ISSUE_FIX[x.kind]}`);
    return [`*${i + 1}. ${name}*`, `${(t.clientId && clientName[t.clientId]) || 'Sem cliente'} · posta ${when(t)}`, ...lines, link].join('\n');
  });
  return [
    `Oi, ${first}! Esses ${posts.length === 1 ? 'post está' : `${posts.length} posts estão`} com pendência na plataforma:`,
    ...blocks,
    'Se algum já foi postado, é só dar baixa no card (mudar para Postado). Qualquer dúvida, me chama!',
  ].join('\n\n');
}
