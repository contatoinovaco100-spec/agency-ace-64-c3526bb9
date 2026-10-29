import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Filter, Link as LinkIcon, Copy, ExternalLink, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import BriefingDetailDialog, { type BriefingRow } from '@/components/BriefingDetailDialog';
import { toast } from 'sonner';

const anim = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.04, duration: 0.35 }
});

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBriefing, setSelectedBriefing] = useState<BriefingRow | null>(null);
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);

  useEffect(() => {
    fetchBriefings();
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name')
      .order('company_name');
    
    if (!error && data) {
      setClients(data.map(c => ({ id: c.id, name: c.company_name })));
    }
  }

  async function fetchBriefings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_briefings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBriefings(data as BriefingRow[]);
    }
    setLoading(false);
  }

  const copyBriefingLink = () => {
    const url = window.location.origin + '/briefing';
    navigator.clipboard.writeText(url);
    toast.success('Link do briefing copiado!', {
      description: url,
    });
  };

  const downloadCSV = () => {
    if (briefings.length === 0) {
      toast.error('Não há briefings para exportar.');
      return;
    }

    // Mapping technical keys to Portuguese labels
    const columnMap: Record<string, string> = {
      company_name: 'Empresa',
      responsible_name: 'Responsável',
      phone: 'Telefone',
      segment: 'Segmento',
      instagram: 'Instagram',
      goals_3_months: 'Objetivos 3 Meses',
      target_age_range: 'Faturamento Público',
      target_gender: 'Gênero Público',
      audience_pain_points: 'Dores do Público',
      audience_desires: 'Desejos do Público',
      purchase_triggers: 'Gatilhos de Compra',
      purchase_blockers: 'Barreiras de Compra',
      current_perception: 'Percepção Atual',
      desired_perception: 'Percepção Desejada',
      differentials: 'Diferenciais',
      competitors: 'Concorrentes',
      communication_style: 'Estilo de Comunicação',
      things_to_avoid: 'O que evitar',
      monthly_revenue: 'Faturamento Mensal',
      status: 'Status',
      created_at: 'Data de Envio'
    };

    const keys = Object.keys(columnMap);
    const headers = Object.values(columnMap).join(';');
    
    const rows = briefings.map(b => 
      keys.map(key => {
        let val = (b as any)[key] || '';
        if (key === 'created_at' && val) {
          val = new Date(val).toLocaleString('pt-BR');
        }
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(';')
    ).join('\n');

    const csvContent = `\uFEFF${headers}\n${rows}`; // Add BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `briefings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Arquivo CSV (Português) gerado com sucesso!');
  };

  const filteredBriefings = briefings.filter(b => 
    b.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.responsible_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.segment?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Briefings</h1>
          <p className="text-sm text-muted-foreground/80">
            Gerencie e visualize as respostas de briefings dos seus clientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 border-primary/20 hover:border-primary/50 text-xs bg-background/50 backdrop-blur-sm transition-all"
            onClick={copyBriefingLink}
          >
            <Copy className="h-4 w-4 text-primary" />
            Link do Briefing
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 border-primary/20 hover:border-primary/50 text-xs bg-background/50 backdrop-blur-sm transition-all"
            onClick={downloadCSV}
          >
            <Download className="h-4 w-4 text-primary" />
            Baixar CSV
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="h-9 gap-2 text-xs shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold"
            onClick={() => window.open('/briefing', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Ver Formulário
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar briefings..." 
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: 'Total de Briefings', value: briefings.length, accent: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Novos', value: briefings.filter(b => b.status === 'novo').length, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
          { label: 'Concluídos', value: briefings.filter(b => b.status === 'concluído').length, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} {...anim(i)}>
            <Card className="border-border/50">
              <CardContent className="p-5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${kpi.accent}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...anim(3)}>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Briefings Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredBriefings.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Nenhum briefing encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 text-left font-medium">Empresa</th>
                      <th className="px-5 py-3 text-left font-medium">Responsável</th>
                      <th className="px-5 py-3 text-left font-medium">Segmento</th>
                      <th className="px-5 py-3 text-left font-medium">Estilo</th>
                      <th className="px-5 py-3 text-center font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Cliente Vinculado</th>
                      <th className="px-5 py-3 text-left font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBriefings.map(b => {
                      const statusColor = b.status === 'novo'
                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        : b.status === 'em análise'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400';
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                          onClick={() => { setSelectedBriefing(b); setBriefingDialogOpen(true); }}
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground">{b.company_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{b.instagram || ''}</p>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{b.responsible_name || '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground">{b.segment || '—'}</td>
                          <td className="px-5 py-3">
                            {b.communication_style && (
                              <Badge variant="secondary" className="text-xs">{b.communication_style}</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                              {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {clients.find(c => c.id === b.client_id)?.name || '—'}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <BriefingDetailDialog
        briefing={selectedBriefing}
        open={briefingDialogOpen}
        onOpenChange={setBriefingDialogOpen}
        clients={clients}
        onUpdate={fetchBriefings}
      />
    </div>
  );
}
