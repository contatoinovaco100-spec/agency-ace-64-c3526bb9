import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { APP_PAGES } from '@/config/app-pages';

// Whitelist absoluta para usuários da Rede de Negócios (empresas parceiras).
export const REDE_COMPANY_ALLOWED_PATHS = ['/negocios', '/rede/perfil', '/rede/novo'];

// Cache em sessão para eliminar latência de checagem de role/empresa em navegações.
const roleCache = new Map<string, boolean>();
const redeCache = new Map<string, { is: boolean; id: string | null }>();
const affiliateCache = new Map<string, boolean>();

function readSessionCache<T>(key: string): T | null {
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function writeSessionCache(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/**
 * Identifica se o usuário logado é dono de uma empresa parceira da Rede.
 * Esses usuários ficam confinados ao feed /negocios e ao seu perfil.
 */
export function useIsRedeCompanyUser() {
  const { user } = useAuth();
  const cached = user
    ? (redeCache.get(`rede:${user.id}`) ?? readSessionCache<{ is: boolean; id: string | null }>(`rede:${user.id}`))
    : null;
  const [isRedeCompanyUser, setIsRedeCompanyUser] = useState(cached?.is ?? false);
  const [companyId, setCompanyId] = useState<string | null>(cached?.id ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user) { setIsRedeCompanyUser(false); setCompanyId(null); setLoading(false); return; }
    const key = `rede:${user.id}`;
    const sessionCached = redeCache.get(key) ?? readSessionCache<{ is: boolean; id: string | null }>(key);
    if (sessionCached) {
      setIsRedeCompanyUser(sessionCached.is);
      setCompanyId(sessionCached.id);
      setLoading(false);
      return;
    }
    supabase
      .from('rede_companies')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const value = { is: !!data, id: data?.id ?? null };
        redeCache.set(key, value);
        writeSessionCache(key, value);
        setIsRedeCompanyUser(value.is);
        setCompanyId(value.id);
        setLoading(false);
      });
  }, [user]);

  return { isRedeCompanyUser, companyId, loading };
}

export function useIsAffiliate() {
  const { user } = useAuth();
  const cached = user
    ? (affiliateCache.get(`aff:${user.id}`) ?? readSessionCache<boolean>(`aff:${user.id}`))
    : null;
  const [isAffiliate, setIsAffiliate] = useState(cached ?? false);
  const [loading, setLoading] = useState(cached === null || cached === undefined);

  useEffect(() => {
    if (!user) { setIsAffiliate(false); setLoading(false); return; }
    const key = `aff:${user.id}`;
    const sessionCached = affiliateCache.get(key) ?? readSessionCache<boolean>(key);
    if (sessionCached !== null && sessionCached !== undefined) {
      setIsAffiliate(sessionCached);
      setLoading(false);
      return;
    }
    supabase
      .from('affiliates')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'aprovado')
      .maybeSingle()
      .then(({ data }) => {
        const value = !!data;
        affiliateCache.set(key, value);
        writeSessionCache(key, value);
        setIsAffiliate(value);
        setLoading(false);
      });
  }, [user]);

  return { isAffiliate, loading };
}

export function useUserRole() {
  const { user } = useAuth();
  const cached = user ? (roleCache.get(`role:${user.id}`) ?? readSessionCache<boolean>(`role:${user.id}`)) : null;
  const [isAdmin, setIsAdmin] = useState<boolean>(cached ?? false);
  const [loading, setLoading] = useState(cached === null || cached === undefined);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    const key = `role:${user.id}`;
    const sessionCached = roleCache.get(key) ?? readSessionCache<boolean>(key);
    if (sessionCached !== null && sessionCached !== undefined) {
      setIsAdmin(sessionCached);
      setLoading(false);
      return;
    }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .then(({ data }) => {
        const admin = !!data && data.length > 0;
        roleCache.set(key, admin);
        writeSessionCache(key, admin);
        setIsAdmin(admin);
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
  const { isRedeCompanyUser, loading: redeLoading } = useIsRedeCompanyUser();
  const { isAffiliate, loading: affiliateLoading } = useIsAffiliate();
  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setAllowedPaths(new Set()); setLoading(false); return; }
    if (roleLoading || redeLoading || affiliateLoading) return;
    if (isAdmin) { setAllowedPaths(new Set(APP_PAGES.map(p => p.path))); setLoading(false); return; }

    // Empresa parceira da Rede: whitelist estrita.
    if (isRedeCompanyUser) {
      setAllowedPaths(new Set(REDE_COMPANY_ALLOWED_PATHS));
      setLoading(false);
      return;
    }

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
  }, [user, isAdmin, roleLoading, isRedeCompanyUser, redeLoading]);

  const hasPageAccess = (path: string) => {
    const page = APP_PAGES.find(p => p.path === path);
    if (page?.affiliateOnly && !isAffiliate) return false;
    
    if (isAdmin) return true;

    // Empresa parceira: ignora alwaysAllowed e libera APENAS a whitelist da Rede.
    if (isRedeCompanyUser) {
      if (REDE_COMPANY_ALLOWED_PATHS.includes(path)) return true;
      for (const allowed of REDE_COMPANY_ALLOWED_PATHS) {
        if (path.startsWith(allowed + '/')) return true;
      }
      return false;
    }

    const page = APP_PAGES.find(p => p.path === path);
    if (page?.alwaysAllowed) return true;
    if (page?.adminOnly) return false;
    if (allowedPaths.has(path)) return true;
    for (const allowed of allowedPaths) {
      if (allowed !== '/' && path.startsWith(allowed + '/')) return true;
    }
    return false;
  };

  return {
    allowedPaths,
    hasPageAccess,
    isAdmin,
    isRedeCompanyUser,
    isAffiliate,
    loading: loading || roleLoading || redeLoading || affiliateLoading,
  };
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
