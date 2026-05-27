import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plus, Eye, CheckCircle2, Wallet, Clock, TrendingUp, Send, Trash2,
  DollarSign, Receipt, Settings as SettingsIcon, Copy, FileDown, Link2,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
} from 'lucide-react';
import { generatePixPayload } from '@/lib/pix';
import { Link } from 'react-router-dom';
import { useAgency } from '@/contexts/AgencyContext';
import { generateInvoicePdf } from '@/lib/invoicePdf';

type Invoice = {
  id: string;
  client_name: string;
  client_contact: string;
  description: string;
  amount: number;
  due_date: string | null;
  status: 'pendente' | 'pago';
  custom_message: string;
  notes: string;
  pix_code: string;
  paid_at: string | null;
  created_at: string;
  is_recurring?: boolean;
  recurrence_day?: number | null;
  month_ref?: string;
};

type PixSettings = {
  id: string;
  key_type: string;
  pix_key: string;
  receiver_name: string;
  city: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FinancialPage() {
  const { clients } = useAgency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<PixSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_contact: '',
    description: '',
    amount: '',
    due_date: '',
    custom_message: '',
    notes: '',
    is_recurring: false,
    recurrence_day: '10',
  });

  const [settingsForm, setSettingsForm] = useState({
    key_type: 'cpf',
    pix_key: '',
    receiver_name: '',
    city: 'SAO PAULO',
  });

  const load = async () => {
    setLoading(true);
    const [inv, set] = await Promise.all([
      (supabase as any).from('invoices').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('pix_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (inv.data) setInvoices(inv.data as Invoice[]);
    if (set.data) {
      setSettings(set.data as PixSettings);
      setSettingsForm({
        key_type: set.data.key_type || 'cpf',
        pix_key: set.data.pix_key || '',
        receiver_name: set.data.receiver_name || '',
        city: set.data.city || 'SAO PAULO',
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const pending = invoices.filter(i => i.status === 'pendente');
    const paid = invoices.filter(i => i.status === 'pago');
    return {
      toReceive: pending.reduce((s, i) => s + Number(i.amount), 0),
      received: paid.reduce((s, i) => s + Number(i.amount), 0),
      pendingCount: pending.length,
      paidCount: paid.length,
    };
  }, [invoices]);

  const saveSettings = async () => {
    if (!settingsForm.pix_key.trim() || !settingsForm.receiver_name.trim()) {
      toast.error('Informe a chave Pix e o nome do recebedor');
      return;
    }
    if (settings?.id) {
      const { error } = await (supabase as any)
        .from('pix_settings')
        .update(settingsForm)
        .eq('id', settings.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from('pix_settings').insert(settingsForm);
      if (error) return toast.error(error.message);
    }
    toast.success('Configuração Pix salva');
    setSettingsOpen(false);
    load();
  };

  const createInvoice = async () => {
    if (!form.client_name.trim() || !form.amount) {
      toast.error('Preencha cliente e valor');
      return;
    }
    if (!settings?.pix_key) {
      toast.error('Configure a chave Pix antes de criar faturas');
      setSettingsOpen(true);
      return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    const txid = `INV${Date.now().toString().slice(-10)}`;
    const pix_code = generatePixPayload({
      pixKey: settings.pix_key,
      receiverName: settings.receiver_name,
      city: settings.city,
      amount,
      txid,
    });

    const recurDay = form.is_recurring
      ? Math.max(1, Math.min(28, parseInt(form.recurrence_day || '10', 10) || 10))
      : null;

    const { error } = await (supabase as any).from('invoices').insert({
      client_name: form.client_name,
      client_contact: form.client_contact,
      description: form.description,
      amount,
      due_date: form.due_date || null,
      custom_message: form.custom_message,
      notes: form.notes,
      pix_code,
      status: 'pendente',
      is_recurring: form.is_recurring,
      recurrence_day: recurDay,
    });

    if (error) return toast.error(error.message);
    toast.success(form.is_recurring ? 'Fatura recorrente criada! Será renovada todo mês.' : 'Fatura criada com sucesso!');
    setOpen(false);
    setForm({
      client_id: '', client_name: '', client_contact: '', description: '',
      amount: '', due_date: '', custom_message: '', notes: '',
      is_recurring: false, recurrence_day: '10',
    });
    load();
  };

  const togglePaid = async (inv: Invoice) => {
    const newStatus = inv.status === 'pago' ? 'pendente' : 'pago';
    const { error } = await (supabase as any)
      .from('invoices')
      .update({
        status: newStatus,
        paid_at: newStatus === 'pago' ? new Date().toISOString() : null,
      })
      .eq('id', inv.id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === 'pago' ? 'Marcada como paga' : 'Reaberta');
    load();
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('Excluir esta fatura?')) return;
    const { error } = await (supabase as any).from('invoices').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Fatura excluída');
    load();
  };

  const shareWhatsApp = (inv: Invoice) => {
    const url = `${window.location.origin}/fatura/${inv.id}`;
    const phone = inv.client_contact.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá! Segue sua fatura:\n\n` +
      `💰 Valor: ${formatBRL(Number(inv.amount))}\n` +
      (inv.due_date ? `📅 Vencimento: ${new Date(inv.due_date + 'T00:00').toLocaleDateString('pt-BR')}\n` : '') +
      `\nAcesse para pagar via Pix:\n${url}\n\nQualquer dúvida estou à disposição 🙂`
    );
    const waUrl = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Faturas, Pix e cobranças</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-4 w-4 mr-2" /> Configurar Pix
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Fatura
          </Button>
        </div>
      </div>

      {/* Aviso config Pix */}
      {!settings?.pix_key && !loading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">Chave Pix não configurada</p>
              <p className="text-sm text-muted-foreground">
                Configure sua chave para gerar QR Codes nas faturas.
              </p>
            </div>
            <Button onClick={() => setSettingsOpen(true)} size="sm">Configurar agora</Button>
          </CardContent>
        </Card>
      )}

      {/* Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total a receber" value={formatBRL(stats.toReceive)} accent="text-amber-500" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Total recebido" value={formatBRL(stats.received)} accent="text-primary" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Pendentes" value={String(stats.pendingCount)} accent="text-amber-500" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Pagas" value={String(stats.paidCount)} accent="text-primary" />
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Faturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="todas">
            <TabsList>
              <TabsTrigger value="todas">Todas ({invoices.length})</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes ({stats.pendingCount})</TabsTrigger>
              <TabsTrigger value="pago">Pagas ({stats.paidCount})</TabsTrigger>
            </TabsList>
            {(['todas', 'pendente', 'pago'] as const).map(tab => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <InvoiceList
                  invoices={invoices.filter(i => tab === 'todas' || i.status === tab)}
                  onTogglePaid={togglePaid}
                  onDelete={deleteInvoice}
                  onShare={shareWhatsApp}
                  loading={loading}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Nova Fatura */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
            <DialogDescription>Crie uma cobrança Pix em segundos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <Field label="Vincular a um cliente existente">
              <Select
                value={form.client_id || 'none'}
                onValueChange={v => {
                  if (v === 'none') {
                    setForm({ ...form, client_id: '', client_name: '', client_contact: '' });
                    return;
                  }
                  const c = clients.find(cl => cl.id === v);
                  if (c) {
                    setForm({
                      ...form,
                      client_id: c.id,
                      client_name: c.companyName || c.contactName,
                      client_contact: c.phone || c.email || '',
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente ou preencha manualmente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Cliente avulso (preencher manualmente) —</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName} {c.contactName ? `· ${c.contactName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome do cliente *">
              <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value, client_id: '' })} />
            </Field>
            <Field label="Contato (WhatsApp ou e-mail)">
              <Input
                placeholder="11999999999"
                value={form.client_contact}
                onChange={e => setForm({ ...form, client_contact: e.target.value })}
              />
            </Field>
            <Field label="Descrição do serviço">
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$) *">
                <Input
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="Vencimento">
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Mensagem personalizada para o cliente">
              <Textarea
                rows={2} placeholder="Obrigado pela parceria 🙌"
                value={form.custom_message}
                onChange={e => setForm({ ...form, custom_message: e.target.value })}
              />
            </Field>
            <Field label="Observações internas">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">🔁 Fatura recorrente (renova todo mês automaticamente)</span>
              </label>
              {form.is_recurring && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Dia do vencimento (1-28)</Label>
                  <Input
                    type="number" min="1" max="28"
                    value={form.recurrence_day}
                    onChange={e => setForm({ ...form, recurrence_day: e.target.value })}
                    className="mt-1 w-32"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createInvoice}>
              <DollarSign className="h-4 w-4 mr-2" /> Criar fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Config Pix */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuração do Pix</DialogTitle>
            <DialogDescription>
              Estes dados serão usados para gerar o QR Code de todas as faturas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Tipo de chave">
              <Select
                value={settingsForm.key_type}
                onValueChange={v => setSettingsForm({ ...settingsForm, key_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Chave Pix *">
              <Input
                value={settingsForm.pix_key}
                onChange={e => setSettingsForm({ ...settingsForm, pix_key: e.target.value })}
                placeholder="ex.: 12345678900 ou contato@inova.mov"
              />
            </Field>
            <Field label="Nome do recebedor *">
              <Input
                value={settingsForm.receiver_name}
                onChange={e => setSettingsForm({ ...settingsForm, receiver_name: e.target.value })}
                placeholder="INOVA CO PRODUCOES"
              />
            </Field>
            <Field label="Cidade (opcional)">
              <Input
                value={settingsForm.city}
                onChange={e => setSettingsForm({ ...settingsForm, city: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            <Button onClick={saveSettings}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`flex items-center gap-2 mb-2 ${accent}`}>{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function InvoiceList({
  invoices, onTogglePaid, onDelete, onShare, loading,
}: {
  invoices: Invoice[];
  onTogglePaid: (i: Invoice) => void;
  onDelete: (id: string) => void;
  onShare: (i: Invoice) => void;
  loading: boolean;
}) {
  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <p>Nenhuma fatura por aqui</p>
      </div>
    );
  }

  const copyPix = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success('Código Pix copiado!');
  };

  const copyPublicLink = async (id: string) => {
    const url = `${window.location.origin}/fatura/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link público copiado!');
  };

  const downloadPdf = async (inv: Invoice) => {
    try {
      const url = `${window.location.origin}/fatura/${inv.id}`;
      await generateInvoicePdf(inv, url);
      toast.success('PDF gerado!');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    }
  };

  return (
    <div className="grid gap-3">
      {invoices.map(inv => (
        <div
          key={inv.id}
          className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border bg-card hover:border-primary/40 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium truncate">{inv.client_name}</span>
              {inv.status === 'pago' ? (
                <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30">Pago</Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/20 border-amber-500/30">Pendente</Badge>
              )}
              {inv.is_recurring && (
                <Badge variant="outline" className="border-primary/40 text-primary">🔁 Recorrente</Badge>
              )}
            </div>
            {inv.description && (
              <p className="text-sm text-muted-foreground truncate">{inv.description}</p>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {inv.due_date && <>Vence: {new Date(inv.due_date + 'T00:00').toLocaleDateString('pt-BR')} · </>}
              Criada: {new Date(inv.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="text-right md:min-w-[120px]">
            <div className="text-lg font-bold">{formatBRL(Number(inv.amount))}</div>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Button asChild size="sm" variant="outline" title="Abrir página pública">
              <Link to={`/fatura/${inv.id}`} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" /> Visualizar
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyPublicLink(inv.id)} title="Copiar link público">
              <Link2 className="h-4 w-4 mr-2" /> Copiar Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadPdf(inv)} title="Baixar PDF com a logo">
              <FileDown className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyPix(inv.pix_code)} title="Copiar Pix">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onShare(inv)} title="Enviar WhatsApp">
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={inv.status === 'pago' ? 'outline' : 'default'}
              onClick={() => onTogglePaid(inv)}
              title={inv.status === 'pago' ? 'Reabrir' : 'Marcar como pago'}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(inv.id)} title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
