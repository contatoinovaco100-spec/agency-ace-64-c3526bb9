import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { UserCog, Plus, KeyRound, UserX, UserCheck, Loader2, Mail } from 'lucide-react';
import { APP_PAGES, EMPLOYEE_EMAIL_DOMAIN, PAGE_CATEGORIES } from '@/config/app-pages';

interface Employee {
  id: string;
  full_name: string;
  username: string | null;
  job_title: string | null;
  is_active: boolean;
  is_admin: boolean;
}

export default function EmployeesPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPages, setSelectedPages] = useState<Set<string>>(
    new Set(APP_PAGES.filter(p => p.alwaysAllowed).map(p => p.path))
  );

  // Reset form
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isAdmin) loadEmployees();
  }, [isAdmin]);

  const loadEmployees = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, job_title, is_active'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
    ]);
    const adminIds = new Set(roles?.map(r => r.user_id) ?? []);
    const list: Employee[] = (profiles ?? []).map(p => ({
      id: p.id,
      full_name: p.full_name || 'Sem nome',
      username: p.username,
      job_title: p.job_title,
      is_active: p.is_active ?? true,
      is_admin: adminIds.has(p.id),
    }));
    // Show employees (with username) first, then any other profiles
    list.sort((a, b) => Number(!!b.username) - Number(!!a.username) || a.full_name.localeCompare(b.full_name));
    setEmployees(list);
    setLoading(false);
  };

  const resetForm = () => {
    setFullName(''); setUsername(''); setJobTitle(''); setPassword('');
    setSelectedPages(new Set(APP_PAGES.filter(p => p.alwaysAllowed).map(p => p.path)));
  };

  const togglePage = (path: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !username.trim() || password.length < 6) {
      toast({ title: 'Preencha todos os campos', description: 'Senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: {
        username: username.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        pages: Array.from(selectedPages).filter(p => {
          const page = APP_PAGES.find(x => x.path === p);
          return page && !page.adminOnly && !page.alwaysAllowed;
        }),
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro ao criar', description: (data as any)?.error ?? error?.message ?? 'Tente novamente', variant: 'destructive' });
      return;
    }
    toast({ title: 'Funcionário criado!', description: `Login: ${username.trim().toLowerCase()}@${EMPLOYEE_EMAIL_DOMAIN}` });
    setCreateOpen(false);
    resetForm();
    loadEmployees();
  };

  const handleResetPassword = async () => {
    if (!resetOpen || newPassword.length < 6) {
      toast({ title: 'Senha muito curta', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('reset-employee-password', {
      body: { user_id: resetOpen.id, password: newPassword },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro', description: (data as any)?.error ?? error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Senha redefinida com sucesso' });
    setResetOpen(null);
    setNewPassword('');
  };

  const handleToggleActive = async (emp: Employee) => {
    await supabase.from('profiles').update({ is_active: !emp.is_active }).eq('id', emp.id);
    loadEmployees();
  };

  if (roleLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie acessos da sua equipe</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Funcionário
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {employees.map(emp => (
            <Card key={emp.id} className={!emp.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                    {emp.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{emp.full_name}</p>
                      {emp.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
                      {!emp.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {emp.job_title && <span>{emp.job_title}</span>}
                      {emp.username && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {emp.username}@{EMPLOYEE_EMAIL_DOMAIN}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {emp.username && !emp.is_admin && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setResetOpen(emp)}>
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> Senha
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(emp)}>
                      {emp.is_active ? <><UserX className="h-3.5 w-3.5 mr-1" /> Desativar</> : <><UserCheck className="h-3.5 w-3.5 mr-1" /> Ativar</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Marcos Silva" />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Editor de vídeo" />
              </div>
              <div>
                <Label>Usuário (login)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="marcos"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">@{EMPLOYEE_EMAIL_DOMAIN}</span>
                </div>
              </div>
              <div>
                <Label>Senha inicial</Label>
                <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Páginas liberadas</Label>
              <div className="rounded-lg border border-border max-h-72 overflow-y-auto p-3 space-y-3">
                {PAGE_CATEGORIES.map(cat => {
                  const items = APP_PAGES.filter(p => p.category === cat && !p.adminOnly);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{cat}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {items.map(p => {
                          const checked = selectedPages.has(p.path) || !!p.alwaysAllowed;
                          return (
                            <label key={p.path} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm hover:bg-secondary/50">
                              <span className="flex items-center gap-2 min-w-0">
                                <p.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{p.label}</span>
                                {p.alwaysAllowed && <Badge variant="secondary" className="text-[9px] py-0 px-1">sempre</Badge>}
                              </span>
                              <Switch
                                checked={checked}
                                disabled={!!p.alwaysAllowed}
                                onCheckedChange={() => togglePage(p.path)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar funcionário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetOpen} onOpenChange={(o) => { if (!o) { setResetOpen(null); setNewPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha — {resetOpen?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="mín. 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetOpen(null); setNewPassword(''); }}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
