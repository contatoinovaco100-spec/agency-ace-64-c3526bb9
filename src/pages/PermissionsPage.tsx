import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Shield, Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { APP_PAGES, PAGE_CATEGORIES, PERMISSIONABLE_PAGES, EMPLOYEE_EMAIL_DOMAIN } from '@/config/app-pages';

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  job_title: string | null;
  is_active: boolean;
}

export default function PermissionsPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accessMap, setAccessMap] = useState<Map<string, Set<string>>>(new Map());
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: profs }, { data: access }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, job_title, is_active'),
      supabase.from('user_page_access').select('user_id, page_path'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
    ]);

    const map = new Map<string, Set<string>>();
    (access ?? []).forEach(r => {
      if (!map.has(r.user_id)) map.set(r.user_id, new Set());
      map.get(r.user_id)!.add(r.page_path);
    });

    setAccessMap(map);
    setAdminIds(new Set(roles?.map(r => r.user_id) ?? []));
    setProfiles((profs ?? []).map(p => ({
      id: p.id,
      full_name: p.full_name || 'Sem nome',
      username: p.username,
      job_title: p.job_title,
      is_active: p.is_active ?? true,
    })));
    setLoading(false);
  };

  // Detect "new" pages: pages in registry that NO non-admin user has access to
  const newPages = useMemo(() => {
    const usedPaths = new Set<string>();
    accessMap.forEach(set => set.forEach(p => usedPaths.add(p)));
    return PERMISSIONABLE_PAGES.filter(p => !usedPaths.has(p.path));
  }, [accessMap]);

  const toggle = async (userId: string, path: string) => {
    setSaving(true);
    const has = accessMap.get(userId)?.has(path) ?? false;
    if (has) {
      await supabase.from('user_page_access').delete().eq('user_id', userId).eq('page_path', path);
    } else {
      await supabase.from('user_page_access').insert({ user_id: userId, page_path: path });
    }
    // optimistic update
    setAccessMap(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(userId) ?? []);
      has ? set.delete(path) : set.add(path);
      next.set(userId, set);
      return next;
    });
    setSaving(false);
  };

  const setAll = async (userId: string, value: boolean) => {
    setSaving(true);
    await supabase.from('user_page_access').delete().eq('user_id', userId);
    if (value) {
      const rows = PERMISSIONABLE_PAGES.map(p => ({ user_id: userId, page_path: p.path }));
      await supabase.from('user_page_access').insert(rows);
    }
    setAccessMap(prev => {
      const next = new Map(prev);
      next.set(userId, value ? new Set(PERMISSIONABLE_PAGES.map(p => p.path)) : new Set());
      return next;
    });
    setSaving(false);
    toast({ title: value ? 'Tudo liberado' : 'Tudo bloqueado' });
  };

  if (roleLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  // Filter out admins from permission management (they have everything)
  const employees = profiles.filter(p => !adminIds.has(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permissões por Página</h1>
          <p className="text-sm text-muted-foreground">
            Defina exatamente quais páginas cada funcionário pode acessar
          </p>
        </div>
      </div>

      {newPages.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                {newPages.length} {newPages.length === 1 ? 'página nova detectada' : 'páginas novas detectadas'}
              </p>
              <p className="text-muted-foreground">
                Ninguém ainda tem acesso a: {newPages.map(p => p.label).join(', ')}. Libere abaixo para os funcionários que precisarem.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum funcionário cadastrado. Vá em <strong className="text-foreground">Funcionários</strong> para criar contas.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {employees.map(emp => {
          const userSet = accessMap.get(emp.id) ?? new Set();
          const totalAllowed = userSet.size;
          const isOpen = expanded === emp.id;

          return (
            <Card key={emp.id} className={!emp.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                      {emp.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.username ? `${emp.username}@${EMPLOYEE_EMAIL_DOMAIN}` : 'sem login'}
                        {emp.job_title ? ` • ${emp.job_title}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{totalAllowed}/{PERMISSIONABLE_PAGES.length} páginas</Badge>
                    <Button size="sm" variant="outline" onClick={() => setAll(emp.id, true)} disabled={saving}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tudo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAll(emp.id, false)} disabled={saving}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Nada
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : emp.id)}>
                      {isOpen ? 'Fechar' : 'Editar'}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="pt-2 border-t border-border space-y-3">
                    {PAGE_CATEGORIES.map(cat => {
                      const items = APP_PAGES.filter(p => p.category === cat && !p.adminOnly && !p.alwaysAllowed);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {items.map(p => {
                              const isNew = newPages.some(n => n.path === p.path);
                              const checked = userSet.has(p.path);
                              return (
                                <label key={p.path} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm hover:bg-secondary/50">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <p.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{p.label}</span>
                                    {isNew && <Badge variant="default" className="text-[9px] py-0 px-1">novo</Badge>}
                                  </span>
                                  <Switch checked={checked} onCheckedChange={() => toggle(emp.id, p.path)} disabled={saving} />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
