import { useState } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutList, Lightbulb, PenTool, Calendar as CalendarIcon, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Componentes das abas que serão criados a seguir
import { UnifiedContentGenerator } from '@/components/content/UnifiedContentGenerator';

export default function ContentPlanningPage() {
  const { clients } = useAgency();
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Planejamento de Conteúdo
          </h1>
          <p className="text-muted-foreground mt-1">
            Hub de estratégia, ideias, roteiros e calendário para os seus clientes.
          </p>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
          <div className="w-full sm:w-[300px]">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full bg-muted/60 border-foreground/10">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedClientId && (
            <Button 
              variant="outline" 
              className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10 transition-colors"
              onClick={() => {
                const url = `${window.location.origin}/portal/${selectedClientId}`;
                navigator.clipboard.writeText(url);
                toast.success('Link do portal copiado para a área de transferência!');
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Portal do Cliente
            </Button>
          )}
        </div>
      </div>

      {!selectedClientId ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 rounded-xl border border-foreground/5 bg-card p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <LayoutList className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-semibold">Tudo começa pelo Cliente</h3>
            <p className="text-muted-foreground text-sm">
              Selecione um cliente no topo da página para criar e visualizar a linha editorial, as ideias de vídeo, roteiros e o calendário de postagens.
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full mt-4">
          <UnifiedContentGenerator clientId={selectedClientId} />
        </div>
      )}
    </motion.div>
  );
}
