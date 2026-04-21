import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { APP_PAGES } from '@/config/app-pages';

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .then(({ data }) => {
        setIsAdmin(!!data && data.length > 0);
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, loading };
}

/**
 * Granular page-level access. Reads user_page_access from Supabase.
 * Admins implicitly have access to everything.
 */
export function usePageAccess() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setAllowedPaths(new Set()); setLoading(false); return; }
    if (roleLoading) return;
    if (isAdmin) { setAllowedPaths(new Set(APP_PAGES.map(p => p.path))); setLoading(false); return; }

    supabase
      .from('user_page_access')
      .select('page_path')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const set = new Set<string>(data?.map(r => r.page_path) ?? []);
        // Always-allowed pages
        APP_PAGES.filter(p => p.alwaysAllowed).forEach(p => set.add(p.path));
        setAllowedPaths(set);
        setLoading(false);
      });
  }, [user, isAdmin, roleLoading]);

  const hasPageAccess = (path: string) => {
    if (isAdmin) return true;
    const page = APP_PAGES.find(p => p.path === path);
    if (page?.alwaysAllowed) return true;
    if (page?.adminOnly) return false;
    // For unknown paths (sub-routes), allow by default if matched any allowed prefix
    if (allowedPaths.has(path)) return true;
    // Allow nested paths like /linktree/123 if /linktree is allowed
    for (const allowed of allowedPaths) {
      if (allowed !== '/' && path.startsWith(allowed + '/')) return true;
    }
    return false;
  };

  return { allowedPaths, hasPageAccess, isAdmin, loading: loading || roleLoading };
}

// ===== Backward-compat exports (legacy module-based code) =====
export type AppModule = 'comercial' | 'operacional';

export const MODULE_LABELS: Record<AppModule, string> = {
  comercial: 'Comercial',
  operacional: 'Operacional',
};

export const MODULE_DESCRIPTIONS: Record<AppModule, string> = {
  comercial: 'CRM, funil de vendas e leads',
  operacional: 'Kanban de tarefas, clientes, equipe e calendário',
};

export const ROUTE_MODULE_MAP: Record<string, AppModule> = {};

/** @deprecated use usePageAccess() */
export function useModuleAccess() {
  const { isAdmin, hasPageAccess, loading } = usePageAccess();
  return {
    modules: [] as AppModule[],
    hasModule: (_m: AppModule) => isAdmin,
    hasPageAccess,
    isAdmin,
    loading,
  };
}
