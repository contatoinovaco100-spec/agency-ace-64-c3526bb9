import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, PhoneCall, CheckCircle2, Target, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';

type Role = 'SDR' | 'Closer' | 'Gestor';

interface Member {
  id: string;
  team_member_id: string | null;
  name: string;
  role: Role;
  active: boolean;
  monthly_goal_calls: number;
  monthly_goal_revenue: number;
}
interface Call {
  id: string;
  member_id: string;
  type: 'agendada' | 'fechada';
  client_name: string | null;
  deal_value: number;
  occurred_at: string;
  source: 'manual' | 'crm';
  notes: string | null;
}
interface Plan {
  id: string;
  role: Role;
  fixed_per_event: number;
  percent_on_value: number;
  goal_type: 'calls' | 'revenue';
  goal_target: number;
  bonus_percent: number;
  notes: string | null;
}
interface TeamMember { id: string; name: string; role: string; }
interface Employee { id: string; full_name: string; job_title: string | null; }

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CommercialTeamPage() {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openMember, setOpenMember] = useState(false);
  const [openCall, setOpenCall] = useState(false);

  const monthStart = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  }, []);

  async function load() {
    setLoading(true);
    const [m, c, p, e] = await Promise.all([
      supabase.from('commercial_members' as any).select('*').order('created_at'),
      supabase.from('commercial_calls' as any).select('*').gte('occurred_at', monthStart.toISOString()).order('occurred_at', { ascending: false }),
      supabase.from('commission_plans' as any).select('*'),
      supabase.from('profiles').select('id, full_name, job_title, is_active').not('username', 'is', null).eq('is_active', true).order('full_name'),
    ]);
    setMembers((m.data as any) || []);
    setCalls((c.data as any) || []);
    setPlans((p.data as any) || []);
    setEmployees(((e.data as any) || []).map((x: any) => ({ id: x.id, full_name: x.full_name || 'Sem nome', job_title: x.job_title })));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('commercial-team-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_members' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_calls' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_plans' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const memberStats = (memberId: string) => {
    const mine = calls.filter(c => c.member_id === memberId);
    const agendadas = mine.filter(c => c.type === 'agendada').length;
    const fechadas = mine.filter(c => c.type === 'fechada').length;
    const revenue = mine.filter(c => c.type === 'fechada').reduce((s, c) => s + Number(c.deal_value || 0), 0);
    return { agendadas, fechadas, revenue };
  };

  const calcCommission = (member: Member) => {
    const plan = plans.find(p => p.role === member.role);
    if (!plan) return { total: 0, fixed: 0, percent: 0, bonus: 0, hitGoal: false };
    const s = memberStats(member.id);
    const events = member.role === 'SDR' ? s.agendadas : s.fechadas;
    const fixed = events * Number(plan.fixed_per_event || 0);
    const percent = s.revenue * (Number(plan.percent_on_value || 0) / 100);
    const goalProgress = plan.goal_type === 'calls' ? events : s.revenue;
    const hitGoal = Number(plan.goal_target) > 0 && goalProgress >= Number(plan.goal_target);
    const bonus = hitGoal ? (fixed + percent) * (Number(plan.bonus_percent || 0) / 100) : 0;
    return { total: fixed + percent + bonus, fixed, percent, bonus, hitGoal };
  };

  const totals = useMemo(() => {
    const agendadas = calls.filter(c => c.type === 'agendada').length;
    const fechadas = calls.filter(c => c.type === 'fechada').length;
    const revenue = calls.filter(c => c.type === 'fechada').reduce((s,c)=>s+Number(c.deal_value||0),0);
    const commissions = members.reduce((s,m)=>s+calcCommission(m).total,0);
    return { agendadas, fechadas, revenue, commissions };
  }, [calls, members, plans]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-heading font-semibold">Time Comercial</h1>
          <p className="text-body text-muted-foreground">Controle de SDRs, Closers e plano de comissionamento — mês atual</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenCall(true)} className="gap-2"><Plus className="h-4 w-4" /> Lançar call</Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setOpenMember(true)} className="gap-2"><Users className="h-4 w-4" /> Membro</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<PhoneCall className="h-4 w-4" />} label="Calls agendadas" value={totals.agendadas.toString()} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Calls fechadas" value={totals.fechadas.toString()} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Faturamento" value={BRL(totals.revenue)} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Comissões a pagar" value={BRL(totals.commissions)} />
      </div>

      <Tabs defaultValue="time" className="w-full">
        <TabsList>
          <TabsTrigger value="time">Time & metas</TabsTrigger>
          <TabsTrigger value="calls">Histórico de calls</TabsTrigger>
          <TabsTrigger value="plano">Plano de comissão</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="space-y-3 mt-4">
          {employees.length === 0 ? (
            <EmptyState message="Nenhum funcionário ativo. Cadastre em Funcionários." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {employees.map(emp => {
                const m = members.find(x => x.team_member_id === emp.id);
                if (!m) {
                  return (
                    <Card key={emp.id} className="border-dashed">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{emp.full_name}</CardTitle>
                            {emp.job_title && <p className="text-xs text-muted-foreground mt-1">{emp.job_title}</p>}
                          </div>
                          <Badge variant="secondary">Sem cargo comercial</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        {isAdmin ? (
                          <div className="flex gap-2 flex-wrap">
                            {(['SDR','Closer','Gestor'] as Role[]).map(r => (
                              <Button key={r} size="sm" variant="outline" onClick={async () => {
                                const { error } = await supabase.from('commercial_members' as any).insert({
                                  team_member_id: emp.id, name: emp.full_name, role: r,
                                  monthly_goal_calls: 0, monthly_goal_revenue: 0,
                                });
                                if (error) return toast.error(error.message);
                                toast.success(`${emp.full_name} definido como ${r}`); load();
                              }}>Tornar {r}</Button>
                            ))}
                          </div>
                        ) : <span>Aguardando definição de cargo pelo admin.</span>}
                      </CardContent>
                    </Card>
                  );
                }
                const s = memberStats(m.id);
                const c = calcCommission(m);
                const plan = plans.find(p => p.role === m.role);
                const goalProgress = plan?.goal_type === 'revenue' ? s.revenue : (m.role === 'SDR' ? s.agendadas : s.fechadas);
                const goal = m.role === 'SDR' ? m.monthly_goal_calls : (plan?.goal_type === 'revenue' ? m.monthly_goal_revenue : m.monthly_goal_calls);
                const pct = goal > 0 ? Math.min(100, (goalProgress/goal)*100) : 0;
                return (
                  <Card key={emp.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{emp.full_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={m.active ? 'default' : 'secondary'}>{m.role}</Badge>
                            {emp.job_title && <span className="text-xs text-muted-foreground">{emp.job_title}</span>}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (!confirm('Remover do time comercial?')) return;
                            await supabase.from('commercial_members' as any).delete().eq('id', m.id);
                            toast.success('Removido'); load();
                          }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded border border-border p-2">
                          <div className="text-xs text-muted-foreground">Agendadas</div>
                          <div className="font-semibold">{s.agendadas}</div>
                        </div>
                        <div className="rounded border border-border p-2">
                          <div className="text-xs text-muted-foreground">Fechadas</div>
                          <div className="font-semibold">{s.fechadas}</div>
                        </div>
                        <div className="rounded border border-border p-2">
                          <div className="text-xs text-muted-foreground">Receita</div>
                          <div className="font-semibold">{BRL(s.revenue)}</div>
                        </div>
                      </div>
                      {goal > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Meta {plan?.goal_type === 'revenue' ? '(receita)' : '(calls)'}</span>
                            <span>{plan?.goal_type === 'revenue' ? BRL(goalProgress) : goalProgress}/{plan?.goal_type === 'revenue' ? BRL(goal) : goal}</span>
                          </div>
                          <div className="h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Comissão do mês</span>
                        <span className="font-semibold text-primary">{BRL(c.total)}{c.hitGoal && <Badge className="ml-2" variant="default">meta ✓</Badge>}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calls" className="mt-4 space-y-3">
          {calls.length === 0 ? <EmptyState message="Nenhuma call registrada este mês." /> : (() => {
            const groups = members
              .map(m => ({ member: m, items: calls.filter(c => c.member_id === m.id) }))
              .filter(g => g.items.length > 0)
              .sort((a, b) => b.items.length - a.items.length);
            const orphan = calls.filter(c => !members.find(m => m.id === c.member_id));
            if (orphan.length) groups.push({ member: { id: 'orphan', name: 'Sem membro vinculado', role: '—' } as any, items: orphan });
            return groups.map(g => {
              const ag = g.items.filter(i => i.type === 'agendada').length;
              const fe = g.items.filter(i => i.type === 'fechada').length;
              const rev = g.items.filter(i => i.type === 'fechada').reduce((s,i)=>s+Number(i.deal_value||0),0);
              return (
                <Card key={g.member.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{g.member.name}</CardTitle>
                        <Badge variant="secondary">{g.member.role}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        <span><PhoneCall className="h-3 w-3 inline mr-1" />{ag}</span>
                        <span><CheckCircle2 className="h-3 w-3 inline mr-1" />{fe}</span>
                        <span className="font-semibold text-foreground">{BRL(rev)}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {g.items.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            {c.type === 'agendada'
                              ? <PhoneCall className="h-4 w-4 text-blue-500 shrink-0" />
                              : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.client_name || 'Sem cliente'}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {format(new Date(c.occurred_at), 'dd/MM HH:mm')} · {c.source}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {c.type === 'fechada' && <span className="font-semibold">{BRL(Number(c.deal_value))}</span>}
                            {isAdmin && (
                              <Button variant="ghost" size="icon" onClick={async () => {
                                await supabase.from('commercial_calls' as any).delete().eq('id', c.id);
                                load();
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </TabsContent>

        <TabsContent value="plano" className="mt-4 space-y-3">
          {!isAdmin && <p className="text-sm text-muted-foreground">Somente admins podem editar o plano.</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map(p => <PlanCard key={p.id} plan={p} editable={isAdmin} onSaved={load} />)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Adicionar membro */}
      <MemberDialog open={openMember} onOpenChange={setOpenMember} employees={employees} existingMembers={members} onSaved={load} />
      {/* Lançar call */}
      <CallDialog open={openCall} onOpenChange={setOpenCall} members={members} onSaved={load} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">{label}{icon}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground text-sm">{message}</div>;
}

function MemberDialog({ open, onOpenChange, employees, existingMembers, onSaved }: any) {
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Role>('SDR');
  const [goalCalls, setGoalCalls] = useState('0');
  const [goalRevenue, setGoalRevenue] = useState('0');
  const [saving, setSaving] = useState(false);

  const usedIds = new Set((existingMembers || []).map((m: Member) => m.team_member_id).filter(Boolean));
  const available = (employees || []).filter((e: Employee) => !usedIds.has(e.id));

  const reset = () => { setEmployeeId(''); setRole('SDR'); setGoalCalls('0'); setGoalRevenue('0'); };

  const save = async () => {
    const emp = (employees || []).find((e: Employee) => e.id === employeeId);
    if (!emp) return toast.error('Selecione um funcionário');
    setSaving(true);
    const { error } = await supabase.from('commercial_members' as any).insert({
      team_member_id: emp.id, name: emp.full_name, role,
      monthly_goal_calls: Number(goalCalls) || 0,
      monthly_goal_revenue: Number(goalRevenue) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Membro adicionado'); reset(); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar membro do time comercial</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Funcionário</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder={available.length ? 'Selecione um funcionário' : 'Nenhum funcionário disponível'} /></SelectTrigger>
              <SelectContent>
                {available.map((e: Employee) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}{e.job_title ? ` — ${e.job_title}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Lista vem de Funcionários cadastrados ativos.</p>
          </div>
          <div>
            <Label>Cargo comercial</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SDR">SDR</SelectItem>
                <SelectItem value="Closer">Closer</SelectItem>
                <SelectItem value="Gestor">Gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Meta calls/mês</Label><Input type="number" value={goalCalls} onChange={e=>setGoalCalls(e.target.value)} /></div>
            <div><Label>Meta receita (R$)</Label><Input type="number" value={goalRevenue} onChange={e=>setGoalRevenue(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !employeeId}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CallDialog({ open, onOpenChange, members, onSaved }: any) {
  const [memberId, setMemberId] = useState('');
  const [type, setType] = useState<'agendada'|'fechada'>('agendada');
  const [client, setClient] = useState('');
  const [value, setValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!memberId) return toast.error('Selecione um membro');
    setSaving(true);
    const { error } = await supabase.from('commercial_calls' as any).insert({
      member_id: memberId, type, client_name: client || null,
      deal_value: type === 'fechada' ? Number(value) || 0 : 0,
      notes: notes || null, source: 'manual',
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Call registrada'); setClient(''); setValue('0'); setNotes('');
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Lançar call</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Membro</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{members.map((m: Member) => <SelectItem key={m.id} value={m.id}>{m.name} — {m.role}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v)=>setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Cliente/Lead</Label><Input value={client} onChange={e=>setClient(e.target.value)} /></div>
          {type === 'fechada' && <div><Label>Valor fechado (R$)</Label><Input type="number" value={value} onChange={e=>setValue(e.target.value)} /></div>}
          <div><Label>Observações</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ plan, editable, onSaved }: { plan: Plan; editable: boolean; onSaved: () => void }) {
  const [p, setP] = useState(plan);
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(plan), [plan]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('commission_plans' as any).update({
      fixed_per_event: Number(p.fixed_per_event) || 0,
      percent_on_value: Number(p.percent_on_value) || 0,
      goal_type: p.goal_type,
      goal_target: Number(p.goal_target) || 0,
      bonus_percent: Number(p.bonus_percent) || 0,
      notes: p.notes,
    }).eq('id', p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Plano salvo'); onSaved();
  };

  const disabled = !editable;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{p.role}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <Label className="text-xs">Fixo por evento (R$)</Label>
          <Input type="number" disabled={disabled} value={p.fixed_per_event} onChange={e=>setP({...p, fixed_per_event: Number(e.target.value)})} />
          <p className="text-[11px] text-muted-foreground mt-1">{p.role === 'SDR' ? 'por call agendada' : 'por venda fechada'}</p>
        </div>
        <div>
          <Label className="text-xs">% sobre valor fechado</Label>
          <Input type="number" step="0.1" disabled={disabled} value={p.percent_on_value} onChange={e=>setP({...p, percent_on_value: Number(e.target.value)})} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Meta por</Label>
            <Select disabled={disabled} value={p.goal_type} onValueChange={(v)=>setP({...p, goal_type: v as any})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calls">Nº de calls</SelectItem>
                <SelectItem value="revenue">Faturamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Alvo</Label>
            <Input type="number" disabled={disabled} value={p.goal_target} onChange={e=>setP({...p, goal_target: Number(e.target.value)})} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Bônus ao bater meta (%)</Label>
          <Input type="number" step="0.1" disabled={disabled} value={p.bonus_percent} onChange={e=>setP({...p, bonus_percent: Number(e.target.value)})} />
          <p className="text-[11px] text-muted-foreground mt-1">% extra sobre (fixo + %) quando meta é atingida</p>
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea disabled={disabled} value={p.notes || ''} onChange={e=>setP({...p, notes: e.target.value})} rows={2} />
        </div>
        {editable && <Button onClick={save} disabled={saving} size="sm" className="w-full">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>}
      </CardContent>
    </Card>
  );
}
