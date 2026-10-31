import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Executa uma ação quando a página abre com ?<param>=valor na URL (ex.: ?novo=1 vindo do botão "+ Novo"
 * ou ?cliente=<id> vindo da busca) e tira o parâmetro em seguida, para não repetir ao recarregar.
 * `ready` permite esperar os dados carregarem antes de agir.
 */
export function useUrlAction(param: string, action: (value: string) => boolean | void, ready = true) {
  const [params, setParams] = useSearchParams();
  const value = params.get(param);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    if (!value || !ready) return;
    // A ação devolve false quando ainda não consegue agir (ex.: o item não carregou); tenta de novo depois
    if (actionRef.current(value) === false) return;
    const next = new URLSearchParams(params);
    next.delete(param);
    setParams(next, { replace: true });
  }, [value, ready, param, params, setParams]);
}
