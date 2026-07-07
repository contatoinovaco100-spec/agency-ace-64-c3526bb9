import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgency } from '@/contexts/AgencyContext';
import { Lead, LeadStage } from '@/types/agency';
import { Plus, Settings2 } from 'lucide-react';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatsAppPanel } from '@/components/crm/WhatsAppPanel';
import { motion } from 'framer-motion';
import { useKanbanStages, colorClasses } from '@/hooks/useKanbanStages';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

export default function CRMPage() {
  const { leads, team, addLead, updateLead, deleteLead } = useAgency();
  const { stages: kanbanStages } = useKanbanStages('crm');
  const { isAdmin } = useUserRole();
  const stages = kanbanStages.map(s => s.name);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({});

  const openNew = (stage?: LeadStage) => {
    setEditing(null);
    setForm({ stage: (stage || stages[0] || 'Lead novo') as LeadStage });
    setDialogOpen(true);
  };
  const openEdit = (l: Lead) => { setEditing(l); setForm(l); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name) return;
    if (editing) {
      updateLead({ ...editing, ...form } as Lead);
    } else {
      addLead({ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString().split('T')[0] } as Lead);
    }
    setDialogOpen(false);
  };

  const moveToStage = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return;
    updateLead({ ...lead, stage });
  };

  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData('text/plain');
    const lead = leads.find(l => l.id === id);
    if (lead) moveToStage(lead, stage as LeadStage);
  };

  const leadsPerStage = stages.reduce((acc, stage) => {
    acc[stage] = leads.filter(l => l.stage === stage);
    return acc;
  }, {} as Record<string, Lead[]>);

  const totalPipeline = leads
    .filter(l => l.stage !== 'Perdido' && l.stage !== 'Cliente fechado')
    .reduce((acc, l) => acc + l.estimatedValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading font-semibold text-foreground">CRM — Pipeline</h1>
          <p className="text-body text-muted-foreground">
            Pipeline: <span className="tabular-nums font-medium text-foreground">R$ {totalPipeline.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> · {leads.length} leads
          </p>
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="flex items-center justify-end gap-2 mb-4">
            {isAdmin && (
              <Button asChild variant="outline" className="gap-2">
                <Link to="/etapas-kanban"><Settings2 className="h-4 w-4" /> Editar etapas</Link>
              </Button>
            )}
            <Button onClick={() => openNew()} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Lead
            </Button>
          </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanStages.map(s => {
          const cc = colorClasses(s.color);
          const stage = s.name;
          return (
          <div
            key={s.id}
            className="flex min-w-[280px] flex-col"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage); }}
            onDragLeave={() => setDragOverStage(prev => prev === stage ? null : prev)}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className={cn('mb-3 flex items-center justify-between rounded-lg border-l-2 bg-card px-3 py-2', cc.border)}>
              <span className="text-caption font-semibold text-foreground">{stage}</span>
              <span className="text-caption tabular-nums text-muted-foreground">{leadsPerStage[stage]?.length || 0}</span>
            </div>
            <div className={cn('flex-1 space-y-2 rounded-lg p-1 transition-colors', dragOverStage === stage && 'bg-primary/10 ring-2 ring-primary/40')}>
              {(leadsPerStage[stage] || []).map(lead => (
                <motion.div
                  key={lead.id}
                  layout
                  whileHover={{ scale: 1.01 }}
                  draggable
                  onDragStart={(e: any) => handleDragStart(e, lead.id)}
                  className="card-shadow cursor-grab active:cursor-grabbing rounded-lg bg-card p-3 transition-default hover:bg-secondary/30"
                  onClick={() => openEdit(lead)}
                >
                  <p className="text-body font-medium text-foreground">{lead.company}</p>
                  <p className="text-caption text-muted-foreground">{lead.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="tabular-nums text-caption font-medium text-success">
                      R$ {lead.estimatedValue.toLocaleString('pt-BR')}
                    </span>
                    {lead.source && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-caption text-muted-foreground">{lead.source}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {lead.assignee && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary">
                          {lead.assignee.charAt(0)}
                        </div>
                        <span className="text-caption text-muted-foreground">{lead.assignee}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <WhatsAppButton phone={lead.phone} name={lead.name} size="sm" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppPanel />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Empresa</Label><Input value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Origem</Label><Input value={form.source || ''} onChange={e => setForm({ ...form, source: e.target.value })} /></div>
              <div><Label>Valor estimado</Label><Input type="number" value={form.estimatedValue || ''} onChange={e => setForm({ ...form, estimatedValue: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Etapa</Label>
                <Select value={form.stage || 'Lead novo'} onValueChange={v => setForm({ ...form, stage: v as LeadStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={form.assignee || ''} onValueChange={v => setForm({ ...form, assignee: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">{editing ? 'Salvar' : 'Adicionar'}</Button>
              {editing && (
                <Button variant="outline" className="text-destructive" onClick={() => { deleteLead(editing.id); setDialogOpen(false); }}>
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
