import { useState } from 'react';
import { Target, Plus, Trash2, TrendingUp, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Goal { id: string; title: string; target: number; current: number; unit: string; category: string; deadline: string; }

const CATEGORIES = ['Financeiro','Clientes','Produção','Equipe','Marketing'];
const COLORS: Record<string,string> = { Financeiro:'text-green-400', Clientes:'text-blue-400', Produção:'text-purple-400', Equipe:'text-yellow-400', Marketing:'text-pink-400' };

const INITIAL_GOALS: Goal[] = [
  { id:'1', title:'Faturamento Mensal', target:30000, current:18500, unit:'R$', category:'Financeiro', deadline:'2026-04-30' },
  { id:'2', title:'Novos Clientes', target:5, current:3, unit:'clientes', category:'Clientes', deadline:'2026-04-30' },
  { id:'3', title:'Vídeos Entregues', target:40, current:28, unit:'vídeos', category:'Produção', deadline:'2026-04-30' },
  { id:'4', title:'Taxa de Retenção', target:95, current:88, unit:'%', category:'Clientes', deadline:'2026-04-30' },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title:'', target:'', current:'', unit:'', category:'Financeiro', deadline:'' });

  const addGoal = () => {
    if (!form.title || !form.target) return;
    setGoals(g => [...g, { id: crypto.randomUUID(), ...form, target: Number(form.target), current: Number(form.current||0) }]);
    setShowModal(false);
    setForm({ title:'', target:'', current:'', unit:'', category:'Financeiro', deadline:'' });
  };

  const updateProgress = (id: string, val: number) => setGoals(g => g.map(x => x.id===id ? {...x, current: Math.min(val, x.target)} : x));
  const deleteGoal = (id: string) => setGoals(g => g.filter(x => x.id !== id));

  const totalComplete = goals.filter(g => g.current >= g.target).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalComplete} de {goals.length} metas concluídas</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Meta</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map(cat => {
          const catGoals = goals.filter(g => g.category === cat);
          if (!catGoals.length) return null;
          const avg = catGoals.reduce((a,g) => a + Math.min((g.current/g.target)*100, 100), 0) / catGoals.length;
          return (
            <div key={cat} className="rounded-xl border border-border bg-card p-4">
              <p className={cn('text-xs font-semibold', COLORS[cat])}>{cat}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{Math.round(avg)}%</p>
              <Progress value={avg} className="h-1.5 mt-2" />
            </div>
          );
        })}
      </div>

      {/* Goals list */}
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map(goal => {
          const pct = Math.min((goal.current / goal.target) * 100, 100);
          const done = goal.current >= goal.target;
          return (
            <div key={goal.id} className={cn('rounded-xl border bg-card p-5 space-y-4 transition-all', done ? 'border-primary/40' : 'border-border')}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <h3 className="font-semibold text-foreground">{goal.title}</h3>
                    <Badge variant="outline" className={cn('text-xs mt-0.5', COLORS[goal.category])}>{goal.category}</Badge>
                  </div>
                </div>
                <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{goal.unit} {goal.current.toLocaleString()} / {goal.target.toLocaleString()}</span>
                  <span className={cn('font-bold', done ? 'text-primary' : 'text-foreground')}>{Math.round(pct)}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={goal.current}
                  onChange={e => updateProgress(goal.id, Number(e.target.value))}
                  className="w-28 h-8 text-sm"
                  min={0} max={goal.target}
                />
                <span className="text-xs text-muted-foreground">Atualizar progresso</span>
                {goal.deadline && <span className="ml-auto text-xs text-muted-foreground">📅 {goal.deadline}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Faturamento Mensal" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Meta</Label><Input type="number" value={form.target} onChange={e => setForm(f=>({...f,target:e.target.value}))} placeholder="Ex: 30000" className="mt-1" /></div>
              <div><Label>Atual</Label><Input type="number" value={form.current} onChange={e => setForm(f=>({...f,current:e.target.value}))} placeholder="0" className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unidade</Label><Input value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} placeholder="R$, clientes, %" className="mt-1" /></div>
              <div><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={e => setForm(f=>({...f,deadline:e.target.value}))} className="mt-1" /></div>
            </div>
            <div><Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f=>({...f,category:v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={addGoal}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
