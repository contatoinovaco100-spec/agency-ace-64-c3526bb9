import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, CheckSquare, Clapperboard, Plus, Target, Users } from 'lucide-react';
import { useAgency } from '@/contexts/AgencyContext';
import type { AppPage } from '@/config/app-pages';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

/** Atalhos de criação: usados pela busca e pelo botão "+ Novo". A página abre já com o formulário (?novo=1). */
export const QUICK_CREATE = [
  { label: 'Nova tarefa', path: '/tarefas', icon: CheckSquare },
  { label: 'Novo cliente', path: '/clientes', icon: Users },
  { label: 'Novo lead', path: '/crm', icon: Target },
  { label: 'Nova gravação', path: '/gravacoes', icon: Clapperboard },
] as const;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const matches = (query: string, ...fields: (string | undefined)[]) => {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const text = norm(fields.filter(Boolean).join(' '));
  return words.every((w) => text.includes(w));
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SEARCH_SHORTCUT = isMac ? '⌘K' : 'Ctrl K';

/**
 * Busca rápida (Ctrl+K / ⌘K): páginas, clientes, tarefas e atalhos de criação num lugar só.
 * Recebe só as páginas que a pessoa pode abrir.
 */
export function CommandPalette({
  open, onOpenChange, pages, canOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: AppPage[];
  canOpen: (path: string) => boolean;
}) {
  const navigate = useNavigate();
  const { clients, tasks } = useAgency();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients]);
  const q = query.trim();

  const create = QUICK_CREATE.filter((a) => canOpen(a.path) && (!q || matches(q, a.label, 'criar adicionar novo nova')));
  const pageHits = (q ? pages.filter((p) => matches(q, p.label, p.category)) : pages.slice(0, 6)).slice(0, 8);
  const clientHits = q
    ? clients.filter((c) => !c.deletedAt && matches(q, c.companyName, c.contactName)).slice(0, 6)
    : [];
  // Tarefas só com 2+ letras: são muitas e a lista vazia já mostra o resto
  const taskHits = q.length >= 2
    ? tasks.filter((t) => matches(q, t.title, t.videoName, clientName.get(t.clientId))).slice(0, 8)
    : [];

  const go = (path: string) => { onOpenChange(false); navigate(path); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl data-[state=open]:slide-in-from-top-2">
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:py-2.5">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar clientes, tarefas e páginas…" />
          <CommandList className="max-h-[min(60dvh,420px)]">
            <CommandEmpty>Nada encontrado para "{q}".</CommandEmpty>

            {clientHits.length > 0 && (
              <CommandGroup heading="Clientes">
                {clientHits.map((c) => (
                  <CommandItem key={c.id} value={`cliente-${c.id}`} onSelect={() => go(`/clientes?cliente=${c.id}`)}>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.companyName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {taskHits.length > 0 && (
              <CommandGroup heading="Tarefas">
                {taskHits.map((t) => (
                  <CommandItem key={t.id} value={`tarefa-${t.id}`} onSelect={() => go(`/tarefas?taskId=${t.id}`)}>
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.title || t.videoName || 'Sem título'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[clientName.get(t.clientId), t.status].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {pageHits.length > 0 && (
              <CommandGroup heading="Páginas">
                {pageHits.map((p) => {
                  const Icon = p.icon;
                  return (
                    <CommandItem key={p.path} value={`pagina-${p.path}`} onSelect={() => go(p.path)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{p.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.category}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {create.length > 0 && (
              <CommandGroup heading="Criar">
                {create.map((a) => (
                  <CommandItem key={a.path} value={`criar-${a.path}`} onSelect={() => go(`${a.path}?novo=1`)}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{a.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="font-sans">↑↓</kbd> navegar</span>
            <span><kbd className="font-sans">Enter</kbd> abrir</span>
            <span className="ml-auto"><kbd className="font-sans">{SEARCH_SHORTCUT}</kbd> abre de qualquer tela</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
