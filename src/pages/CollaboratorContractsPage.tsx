import { useState } from 'react';
import { FileText, Plus, Search, Eye, Download, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Status = 'ativo'|'pendente'|'expirado'|'cancelado';

interface CollabContract {
  id: string; collaborator: string; role: string; value: number; startDate: string; endDate: string; status: Status; notes: string;
}

const STATUS_CONFIG: Record<Status, { label: string; icon: any; color: string }> = {
  ativo:     { label:'Ativo',     icon: CheckCircle, color:'text-green-400 bg-green-400/10 border-green-400/20' },
  pendente:  { label:'Pendente',  icon: Clock,       color:'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  expirado:  { label:'Expirado',  icon: AlertCircle, color:'text-red-400 bg-red-400/10 border-red-400/20' },
  cancelado: { label:'Cancelado', icon: AlertCircle, color:'text-muted-foreground bg-muted border-border' },
};

const ROLES = ['Editor de Vídeo','Videomaker','Roteirista','Designer','Copywriter','Diretor de Arte','Motion Designer','Fotógrafo','Social Media'];

const INITIAL: CollabContract[] = [
  { id:'1', collaborator:'Carlos Silva', role:'Editor de Vídeo', value:3500, startDate:'2026-03-01', endDate:'2026-06-01', status:'ativo', notes:'Especialista em edição de reels e vídeos curtos.' },
  { id:'2', collaborator:'Ana Beatriz', role:'Roteirista', value:2000, startDate:'2026-04-01', endDate:'2026-07-01', status:'ativo', notes:'Criação de roteiros para vídeos institucionais.' },
  { id:'3', collaborator:'João Ferreira', role:'Videomaker', value:4000, startDate:'2026-01-01', endDate:'2026-04-30', status:'pendente', notes:'Aguardando renovação de contrato.' },
];

export default function CollaboratorContractsPage() {
  const [contracts, setContracts] = useState<CollabContract[]>(INITIAL);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState<CollabContract|null>(null);
  const [form, setForm] = useState({ collaborator:'', role:'Editor de Vídeo', value:'', startDate:'', endDate:'', notes:'', status:'pendente' as Status });

  const filtered = contracts.filter(c =>
    (filterStatus==='all' || c.status===filterStatus) &&
    (c.collaborator.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase()))
  );

  const addContract = () => {
    if (!form.collaborator || !form.value) return;
    setContracts(c => [...c, { id: crypto.randomUUID(), ...form, value: Number(form.value) }]);
    setShowModal(false);
    setForm({ collaborator:'', role:'Editor de Vídeo', value:'', startDate:'', endDate:'', notes:'', status:'pendente' });
  };

  const deleteContract = (id: string) => setContracts(c => c.filter(x => x.id !== id));

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Contratos de Prestadores</h1>
          <p className="text-muted-foreground text-sm mt-1">{contracts.filter(c=>c.status==='ativo').length} contratos ativos</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Novo Contrato</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = contracts.filter(c => c.status === key).length;
          return (
            <div key={key} className={cn('rounded-xl border p-4 cursor-pointer transition-all', filterStatus===key ? 'border-primary/50 bg-primary/5' : 'border-border bg-card hover:border-border/80')}
              onClick={() => setFilterStatus(filterStatus===key ? 'all' : key)}>
              <cfg.icon className={cn('h-5 w-5 mb-2', cfg.color.split(' ')[0])} />
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar colaborador ou função..." className="pl-9" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Colaborador</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Função</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vigência</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => {
              const cfg = STATUS_CONFIG[c.status];
              return (
                <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.collaborator}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.role}</td>
                  <td className="px-4 py-3 text-foreground">{fmt(c.value)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.startDate} → {c.endDate}</td>
                  <td className="px-4 py-3">
                    <Badge className={cn('text-xs border', cfg.color)}><cfg.icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewModal(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteContract(c.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>Nenhum contrato encontrado.</p></div>}
      </div>

      {/* Add Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Novo Contrato de Prestador</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Colaborador</Label><Input value={form.collaborator} onChange={e => setForm(f=>({...f,collaborator:e.target.value}))} placeholder="Nome completo" className="mt-1" /></div>
              <div><Label>Função</Label>
                <Select value={form.role} onValueChange={v => setForm(f=>({...f,role:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" value={form.value} onChange={e => setForm(f=>({...f,value:e.target.value}))} placeholder="Ex: 3500" className="mt-1" /></div>
              <div><Label>Início</Label><Input type="date" value={form.startDate} onChange={e => setForm(f=>({...f,startDate:e.target.value}))} className="mt-1" /></div>
              <div><Label>Término</Label><Input type="date" value={form.endDate} onChange={e => setForm(f=>({...f,endDate:e.target.value}))} className="mt-1" /></div>
              <div className="col-span-2"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f=>({...f,status:v as Status}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Detalhes do contrato..." className="mt-1" rows={3} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={addContract}><Plus className="h-4 w-4 mr-1" /> Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      {viewModal && (
        <Dialog open onOpenChange={() => setViewModal(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{viewModal.collaborator}</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Função:</span><span className="text-foreground font-medium">{viewModal.role}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="text-foreground font-medium">{fmt(viewModal.value)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vigência:</span><span className="text-foreground">{viewModal.startDate} → {viewModal.endDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><Badge className={cn('border text-xs', STATUS_CONFIG[viewModal.status].color)}>{STATUS_CONFIG[viewModal.status].label}</Badge></div>
              {viewModal.notes && <div className="pt-2 border-t border-border"><span className="text-muted-foreground block mb-1">Observações:</span><p className="text-foreground">{viewModal.notes}</p></div>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setViewModal(null)}>Fechar</Button><Button variant="outline" className="flex items-center gap-2"><Download className="h-4 w-4" /> Exportar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
