import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { isChunkError, reloadOnceForNewVersion, reportError } from '@/lib/errorReporter';

/**
 * Quando uma tela quebra, mostra um aviso com "Recarregar" em vez da tela branca
 * e registra o erro para os admins. `compact` é a versão que fica dentro do layout (o menu continua).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Versão nova publicada enquanto a aba estava aberta: recarrega sozinho uma vez
    if (isChunkError(error.message) && reloadOnceForNewVersion()) return;
    reportError(error, isChunkError(error.message) ? 'chunk' : 'render', info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.compact ? 'flex min-h-[60dvh] items-center justify-center p-6' : 'flex min-h-[100dvh] items-center justify-center bg-background p-6'}>
        <div className="max-w-sm text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-lg font-semibold text-foreground">Esta tela teve um problema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O erro já foi registrado para a equipe corrigir. Recarregar costuma resolver.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <RotateCw className="h-4 w-4" /> Recarregar
          </button>
        </div>
      </div>
    );
  }
}
