import { useState } from 'react';
import { TrendingUp, Plus, CheckCircle2, AlertCircle, Lightbulb, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WeeklyResult {
  id: string; week: string; victories: string[]; challenges: string[]; learnings: string[]; nextActions: string[];
  metrics: { label: string; value: string; trend: 'up'|'down'|'stable' }[];
}

const SAMPLE: WeeklyResult = {
  id: '1', week: '14/04 – 17/04/2026',
  victories: ['Fechamos 2 novos clientes', 'Entregamos 12 vídeos no prazo','Equipe completou treinamento de edição'],
  challenges: ['Atraso em gravação do cliente Alfa','Retrabalho em 3 vídeos por mudança de briefing'],
  learnings: ['Alinhar briefing antes de iniciar produção', 'Check-in semanal melhora comunicação'],
  nextActions: ['Criar template de briefing revisado','Reunião de alinhamento toda segunda 9h','Definir metas de maio'],
  metrics: [
    { label: 'Vídeos entregues', value: '12', trend: 'up' },
    { label: 'Novos clientes', value: '2', trend: 'up' },
    { label: 'NPS estimado', value: '8.5', trend: 'stable' },
    { label: 'Horas extras evitadas', value: '0h', trend: 'up' },
  ]
};

export default function WeeklyResultsPage() {
  const [results, setResults] = useState<WeeklyResult[]>([SAMPLE]);
  const [active, setActive] = useState(SAMPLE.id);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ week: '', victories: '', challenges: '', learnings: '', nextActions: '' });

  const addResult = () => {
    const nr: WeeklyResult = {
      id: crypto.randomUUID(), week: form.week,
      victories: form.victories.split('\n').filter(Boolean),
      challenges: form.challenges.split('\n').filter(Boolean),
      learnings: form.learnings.split('\n').filter(Boolean),
      nextActions: form.nextActions.split('\n').filter(Boolean),
      metrics: [],
    };
    setResults(r => [nr, ...r]);
    setActive(nr.id);
    setShowForm(false);
  };

  const current = results.find(r => r.id === active);

  const Section = ({ icon: Icon, title, items, color }: { icon: any; title: string; items: string[]; color: string }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className={cn('font-semibold flex items-center gap-2 mb-3', color)}><Icon className="h-4 w-4" />{title}</h3>
      <ul className="space-y-2">
        {items.map((it, i) => <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />{it}</li>)}
        {!items.length && <li className="text-sm text-muted-foreground italic">Nenhum item registrado.</li>}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Resultados Semanais</h1>
          <p className="text-muted-foreground text-sm mt-1">Retrospectiva e acompanhamento de progresso</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Semana</Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Registrar Semana</h3>
          <div><Label>Período</Label><Input value={form.week} onChange={e => setForm(f=>({...f,week:e.target.value}))} placeholder="Ex: 14/04 – 17/04/2026" className="mt-1" /></div>
          <div><Label>Vitórias (uma por linha)</Label><Textarea rows={3} value={form.victories} onChange={e => setForm(f=>({...f,victories:e.target.value}))} placeholder="Descreva as conquistas da semana..." className="mt-1" /></div>
          <div><Label>Desafios (uma por linha)</Label><Textarea rows={3} value={form.challenges} onChange={e => setForm(f=>({...f,challenges:e.target.value}))} placeholder="O que dificultou o progresso?..." className="mt-1" /></div>
          <div><Label>Aprendizados (uma por linha)</Label><Textarea rows={3} value={form.learnings} onChange={e => setForm(f=>({...f,learnings:e.target.value}))} placeholder="O que aprendemos?..." className="mt-1" /></div>
          <div><Label>Próximas Ações (uma por linha)</Label><Textarea rows={3} value={form.nextActions} onChange={e => setForm(f=>({...f,nextActions:e.target.value}))} placeholder="O que faremos diferente?..." className="mt-1" /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={addResult}>Salvar</Button>
          </div>
        </div>
      )}

      {/* Week tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {results.map(r => (
          <button key={r.id} onClick={() => setActive(r.id)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              active===r.id ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            )}>
            {r.week}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-4">
          {/* Metrics */}
          {current.metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {current.metrics.map((m, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
                  <Badge variant="outline" className={cn('text-xs mt-1', m.trend==='up'?'text-green-400':m.trend==='down'?'text-red-400':'text-muted-foreground')}>
                    {m.trend==='up'?'↑ Crescimento':m.trend==='down'?'↓ Queda':'→ Estável'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <Section icon={CheckCircle2} title="Vitórias" items={current.victories} color="text-green-400" />
            <Section icon={AlertCircle} title="Desafios" items={current.challenges} color="text-orange-400" />
            <Section icon={Lightbulb} title="Aprendizados" items={current.learnings} color="text-blue-400" />
            <Section icon={Star} title="Próximas Ações" items={current.nextActions} color="text-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
