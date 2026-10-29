import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Phone, AtSign, Target, Users, Heart, ShieldAlert, Eye, Star, Swords, MessageCircle, Ban, DollarSign, Layers, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BriefingRow {
  id: string;
  client_id?: string | null;
  company_name: string;
  responsible_name: string;
  phone: string;
  segment: string;
  instagram: string;
  goals_3_months: string;
  target_age_range: string;
  target_gender: string;
  audience_pain_points: string;
  audience_desires: string;
  purchase_triggers: string;
  purchase_blockers: string;
  current_perception: string;
  desired_perception: string;
  differentials: string;
  competitors: string;
  communication_style: string;
  things_to_avoid: string;
  monthly_revenue: string;
  status: string;
  created_at: string;
}

interface Props {
  briefing: BriefingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  onUpdate: () => void;
}

function Section({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-5.5">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    novo: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    'em análise': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    concluído: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  };
  return (
    <Badge variant="outline" className={map[status] || 'bg-secondary text-muted-foreground'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function BriefingDetailDialog({ briefing, open, onOpenChange, clients, onUpdate }: Props) {
  const [isLinking, setIsLinking] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (briefing) {
      setSelectedClientId(briefing.client_id || null);
    }
  }, [briefing]);

  if (!briefing) return null;

  async function handleLinkClient() {
    if (!selectedClientId) return;
    
    const { error } = await supabase
      .from('client_briefings')
      .update({ client_id: selectedClientId })
      .eq('id', briefing!.id);

    if (error) {
      toast.error('Erro ao vincular cliente: ' + error.message);
    } else {
      toast.success('Briefing vinculado ao cliente com sucesso!');
      setIsLinking(false);
      onUpdate();
    }
  }

  const linkedClientName = clients.find(c => c.id === briefing.client_id)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold">{briefing.company_name || 'Sem nome'}</DialogTitle>
                <StatusBadge status={briefing.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Enviado em {new Date(briefing.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {!briefing.client_id && !isLinking && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-2 border-primary/20 hover:border-primary/50 text-xs"
                  onClick={() => setIsLinking(true)}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Vincular Cliente
                </Button>
              )}
              {briefing.client_id && (
                <Badge variant="secondary" className="h-6 gap-1.5 bg-primary/5 text-primary border-primary/20">
                  <Check className="h-3 w-3" />
                  Cliente: {linkedClientName}
                </Badge>
              )}
            </div>
          </div>

          {isLinking && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-center gap-3"
            >
              <div className="flex-1 w-full">
                <Select value={selectedClientId || ""} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full bg-background border-border/50">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button size="sm" className="flex-1 sm:flex-none" onClick={handleLinkClient}>Confirmar</Button>
                <Button size="sm" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setIsLinking(false)}>Cancelar</Button>
              </div>
            </motion.div>
          )}
        </DialogHeader>

        <div className="space-y-6 pt-6">
          {/* Info Básicas */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Informações Básicas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-3">
              <Section icon={Building2} label="Empresa" value={briefing.company_name} />
              <Section icon={User} label="Responsável" value={briefing.responsible_name} />
              <Section icon={Phone} label="Telefone" value={briefing.phone} />
              <Section icon={Layers} label="Segmento" value={briefing.segment} />
              <Section icon={AtSign} label="Instagram" value={briefing.instagram} />
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Objetivos */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              Objetivos Estratégicos
            </h3>
            <div className="pl-3">
              <Section icon={Target} label="Metas para 3 meses" value={briefing.goals_3_months} />
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Público-Alvo */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Público-Alvo
            </h3>
            <div className="space-y-6 pl-3">
              <div className="grid grid-cols-2 gap-6">
                <Section icon={Users} label="Faixa Etária" value={briefing.target_age_range} />
                <Section icon={Users} label="Gênero" value={briefing.target_gender} />
              </div>
              <Section icon={ShieldAlert} label="Dores do público" value={briefing.audience_pain_points} />
              <Section icon={Heart} label="Desejos do público" value={briefing.audience_desires} />
              <Section icon={Target} label="Gatilhos de compra" value={briefing.purchase_triggers} />
              <Section icon={Ban} label="Bloqueios de compra" value={briefing.purchase_blockers} />
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Posicionamento */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
              Posicionamento de Marca
            </h3>
            <div className="space-y-6 pl-3">
              <Section icon={Eye} label="Percepção atual" value={briefing.current_perception} />
              <Section icon={Star} label="Percepção desejada" value={briefing.desired_perception} />
              <Section icon={Star} label="Diferenciais" value={briefing.differentials} />
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Referências */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              Referências e Estilo
            </h3>
            <div className="space-y-6 pl-3">
              <Section icon={Swords} label="Concorrentes/Referências" value={briefing.competitors} />
              <Section icon={MessageCircle} label="Estilo de Comunicação" value={briefing.communication_style} />
              <Section icon={Ban} label="O que evitar" value={briefing.things_to_avoid} />
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Faturamento */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              Financeiro
            </h3>
            <div className="pl-3 pb-4">
              <Section icon={DollarSign} label="Faturamento Mensal" value={briefing.monthly_revenue} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
