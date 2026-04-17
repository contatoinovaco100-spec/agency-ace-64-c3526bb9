import { useState } from 'react';
import { BookOpen, CheckCircle2, Circle, ChevronDown, ChevronRight, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Step { id: string; title: string; desc: string; done: boolean; }
interface Phase { id: string; title: string; icon: string; steps: Step[]; }

const PHASES: Phase[] = [
  {
    id: 'welcome', title: 'Boas-Vindas', icon: '👋',
    steps: [
      { id: 's1', title: 'Reunião de Kickoff', desc: 'Apresentação da equipe, alinhamento de expectativas e objetivos.', done: true },
      { id: 's2', title: 'Assinatura do Contrato', desc: 'Formalização da parceria com todos os termos acordados.', done: true },
      { id: 's3', title: 'Acesso à Plataforma', desc: 'Envio de credenciais e tutorial de uso da plataforma.', done: true },
    ]
  },
  {
    id: 'briefing', title: 'Briefing & Estratégia', icon: '📋',
    steps: [
      { id: 's4', title: 'Preenchimento do Briefing', desc: 'Questionário completo sobre marca, público e objetivos.', done: true },
      { id: 's5', title: 'Linha Editorial', desc: 'Definição dos pilares de conteúdo, tom de voz e personas.', done: false },
      { id: 's6', title: 'Planejamento 30 dias', desc: 'Calendário de conteúdo do primeiro mês.', done: false },
    ]
  },
  {
    id: 'producao', title: 'Produção', icon: '🎬',
    steps: [
      { id: 's7', title: 'Primeira Gravação', desc: 'Sessão piloto para alinhar estilo visual e comunicação.', done: false },
      { id: 's8', title: 'Aprovação de Materiais', desc: 'Revisão e aprovação dos primeiros conteúdos criados.', done: false },
      { id: 's9', title: 'Publicação Inicial', desc: 'Primeiras publicações nas redes sociais acordadas.', done: false },
    ]
  },
  {
    id: 'otimizacao', title: 'Otimização', icon: '📈',
    steps: [
      { id: 's10', title: 'Relatório de Resultados', desc: 'Análise dos primeiros 30 dias com métricas e insights.', done: false },
      { id: 's11', title: 'Ajustes de Estratégia', desc: 'Refinamento baseado nos dados coletados.', done: false },
      { id: 's12', title: 'Reunião Mensal', desc: 'Check-in mensal de resultados e planejamento.', done: false },
    ]
  },
];

export default function OnboardingPage() {
  const [phases, setPhases] = useState<Phase[]>(PHASES);
  const [expanded, setExpanded] = useState<string|null>('welcome');

  const allSteps = phases.flatMap(p => p.steps);
  const doneSteps = allSteps.filter(s => s.done).length;
  const pct = Math.round((doneSteps / allSteps.length) * 100);

  const toggleStep = (phaseId: string, stepId: string) => {
    setPhases(ps => ps.map(p => p.id !== phaseId ? p : {
      ...p, steps: p.steps.map(s => s.id !== stepId ? s : { ...s, done: !s.done })
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Onboarding Kit</h1>
          <p className="text-muted-foreground text-sm mt-1">Processo de integração do cliente</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2"><Download className="h-4 w-4" /> Exportar PDF</Button>
      </div>

      {/* Progress Bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-foreground">Progresso Geral</span>
          <span className="text-2xl font-bold text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-3" />
        <p className="text-sm text-muted-foreground mt-2">{doneSteps} de {allSteps.length} etapas concluídas</p>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        {phases.map((phase, pi) => {
          const phaseDone = phase.steps.filter(s => s.done).length;
          const isOpen = expanded === phase.id;
          return (
            <div key={phase.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : phase.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{phase.icon}</span>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{phase.title}</p>
                    <p className="text-xs text-muted-foreground">{phaseDone}/{phase.steps.length} etapas</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={(phaseDone/phase.steps.length)*100} className="h-1.5 w-24" />
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border">
                  {phase.steps.map((step, si) => (
                    <div key={step.id} className={cn('flex items-start gap-3 p-4 border-b border-border last:border-0',
                      step.done && 'bg-primary/5'
                    )}>
                      <button onClick={() => toggleStep(phase.id, step.id)} className="mt-0.5 flex-shrink-0">
                        {step.done
                          ? <CheckCircle2 className="h-5 w-5 text-primary" />
                          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        }
                      </button>
                      <div className="flex-1">
                        <p className={cn('font-medium text-sm', step.done ? 'text-primary line-through opacity-70' : 'text-foreground')}>{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{pi+1}.{si+1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
