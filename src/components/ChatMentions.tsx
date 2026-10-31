import { Fragment, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { ChatEmployee } from '@/lib/chat';

/** @todos avisa a equipe inteira; o resto é @usuario do cadastro de funcionários */
export const MENTION_ALL = 'todos';
const MENTION_RE = /(^|\s)@([\w.-]+)/g;

/** A mensagem menciona esta pessoa (pelo usuário) ou a equipe toda? */
export function mentionsUser(content: string, username: string | null | undefined) {
  const names = [...content.matchAll(MENTION_RE)].map((m) => m[2].toLowerCase());
  return names.includes(MENTION_ALL) || (!!username && names.includes(username.toLowerCase()));
}

/** Texto da mensagem com as @menções destacadas */
export function MentionText({ content, onPrimary }: { content: string; onPrimary?: boolean }) {
  const parts = content.split(/((?:^|\s)@[\w.-]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^(\s?)@([\w.-]+)$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Fragment key={i}>
            {m[1]}
            <span className={cn('rounded px-0.5 font-semibold', onPrimary ? 'bg-primary-foreground/15' : 'bg-primary/15 text-primary')}>@{m[2]}</span>
          </Fragment>
        );
      })}
    </>
  );
}

type Suggestion = { username: string; label: string };

/**
 * Autocompletar de @menção para o campo de mensagem: ao digitar "@jo" aparecem os colegas;
 * setas escolhem, Enter ou Tab completam. Devolve o onKeyDown, que deve rodar antes do Enter de enviar.
 */
export function useMentionInput(text: string, setText: (v: string) => void, employees: ChatEmployee[], selfId?: string) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const match = text.match(/(?:^|\s)@([\w.-]*)$/);
  const query = match ? match[1].toLowerCase() : null;
  const all: Suggestion[] = [
    { username: MENTION_ALL, label: 'Avisar a equipe toda' },
    ...employees
      .filter((e) => e.username && e.id !== selfId)
      .map((e) => ({ username: e.username!, label: e.full_name || e.username! })),
  ];
  const suggestions = query === null || dismissed === text ? [] : all
    .filter((s) => s.username.toLowerCase().startsWith(query) || s.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(query)))
    .slice(0, 6);
  const current = Math.min(index, Math.max(0, suggestions.length - 1));

  const pick = (s: Suggestion) => {
    setText(text.replace(/@([\w.-]*)$/, `@${s.username} `));
    setIndex(0);
  };

  /** true quando a tecla foi usada pelo autocompletar */
  const onKeyDown = (e: KeyboardEvent) => {
    if (!suggestions.length) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((current + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(suggestions[current]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDismissed(text);
      return true;
    }
    return false;
  };

  const list = suggestions.length > 0 && (
    <div role="listbox" aria-label="Mencionar colega" className="raised-shadow absolute inset-x-2 bottom-full mb-1 overflow-hidden rounded-lg border border-border bg-popover py-1">
      {suggestions.map((s, i) => (
        <button
          key={s.username}
          type="button"
          role="option"
          aria-selected={i === current}
          onMouseDown={(e) => { e.preventDefault(); pick(s); }}
          onMouseEnter={() => setIndex(i)}
          className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === current && 'bg-accent')}
        >
          <span className="font-medium">@{s.username}</span>
          <span className="truncate text-xs text-muted-foreground">{s.label}</span>
        </button>
      ))}
    </div>
  );

  return { onKeyDown, list };
}
