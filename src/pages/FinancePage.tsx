import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Plus, Settings, Eye, CheckCircle2, Clock, FileText,
  Copy, Send, Trash2, Edit2, QrCode, CreditCard, TrendingUp,
  AlertCircle, Search, Calendar, ArrowUpRight, Banknote, Receipt,
  Zap, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

// ─── PIX BR Code Generator (EMV Standard) ────────────────────────────────
function padValue(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function computeCRC16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(config: PixConfig, amount: number, txId?: string): string {
  // Payload Format Indicator
  let payload = padValue('00', '01');
  // Point of Initiation Method (12 = one-time)
  payload += padValue('01', '12');
  // Merchant Account Information — PIX
  const gui = padValue('00', 'br.gov.bcb.pix');
  const key = padValue('01', config.pixKey);
  payload += padValue('26', gui + key);
  // Merchant Category Code
  payload += padValue('52', '0000');
  // Transaction Currency (986 = BRL)
  payload += padValue('53', '986');
  // Transaction Amount
  if (amount > 0) {
    payload += padValue('54', amount.toFixed(2));
  }
  // Country Code
  payload += padValue('58', 'BR');
  // Merchant Name (max 25 chars)
  const name = removeAccents(config.receiverName).substring(0, 25).toUpperCase();
  payload += padValue('59', name);
  // Merchant City (max 15 chars)
  const city = removeAccents(config.city || 'SAO PAULO').substring(0, 15).toUpperCase();
  payload += padValue('60', city);
  // Additional Data Field Template
  const txIdVal = txId || '***';
  payload += padValue('62', padValue('05', txIdVal));
  // CRC placeholder
  payload += '6304';
  // Calculate CRC16
  const crc = computeCRC16(payload);
  return payload + crc;
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Types ────────────────────────────────────────────────────────────────
interface PixConfig {
  keyType: 'cpf' | 'email' | 'phone' | 'random';
  pixKey: string;
  receiverName: string;
  city: string;
}

interface Invoice {
  id: string;
  clientName: string;
  clientContact: string;
  description: string;
  amount: number;
  dueDate: string;
  notes: string;
  customMessage: string;
  status: 'pending' | 'paid';
  createdAt: string;
  paidAt: string | null;
}

const KEY_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Aleatória'
};

const DEFAULT_PIX: PixConfig = {
  keyType: 'cpf', pixKey: '', receiverName: '', city: ''
};

// ─── Formatting helpers ──────────────────────────────────────────────────
const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

// ─── Component ───────────────────────────────────────────────────────────
export default function FinancePage() {
  const { clients } = useAgency();
  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pixConfig, setPixConfig] = useState<PixConfig>(DEFAULT_PIX);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [viewAllMonths, setViewAllMonths] = useState(false);

  const [form, setForm] = useState({
    clientName: '', clientContact: '', description: '',
    amount: '', dueDate: '', notes: '', customMessage: '',
    installments: '1'
  });

  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoMonth, setAutoMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [autoDueDate, setAutoDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(true);

  // Fetch from Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, pixRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('pix_settings').select('*').limit(1).maybeSingle()
      ]);

      if (invRes.data) {
        const mapped: Invoice[] = invRes.data.map((i: any) => ({
          id: i.id,
          clientName: i.client_name,
          clientContact: i.client_contact,
          description: i.description,
          amount: Number(i.amount),
          dueDate: i.due_date || '',
          notes: i.notes || '',
          customMessage: i.custom_message || '',
          status: i.status === 'pago' ? 'paid' : 'pending',
          createdAt: i.created_at,
          paidAt: i.paid_at
        }));
        setInvoices(mapped);
      }

      if (pixRes.data) {
        setPixConfig({
          keyType: pixRes.data.key_type as PixConfig['keyType'],
          pixKey: pixRes.data.pix_key,
          receiverName: pixRes.data.receiver_name,
          city: pixRes.data.city
        });
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Persist
  const saveInvoices = useCallback(async (updated: Invoice[]) => {
    setInvoices(updated);
    // Note: We don't save the entire array anymore, we handle per-action
  }, []);

  const savePixConfig = useCallback(async (updated: PixConfig) => {
    setPixConfig(updated);
    try {
      const { data: existing } = await supabase.from('pix_settings').select('id').limit(1).maybeSingle();
      if (existing) {
        await supabase.from('pix_settings').update({
          key_type: updated.keyType,
          pix_key: updated.pixKey,
          receiver_name: updated.receiverName,
          city: updated.city,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await supabase.from('pix_settings').insert({
          key_type: updated.keyType,
          pix_key: updated.pixKey,
          receiver_name: updated.receiverName,
          city: updated.city
        });
      }
      toast.success('Configurações do Pix salvas!');
    } catch (error) {
      toast.error('Erro ao salvar configurações do Pix');
    }
  }, []);

  // Month helpers
  const monthKey = (d?: string | Date | null) => {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  const selectedKey = monthKey(selectedMonth);
  const monthLabel = (key: string) => {
    if (!key) return '';
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Invoices of selected month (uses dueDate, fallback createdAt)
  const invoicesOfMonth = useMemo(() => {
    if (viewAllMonths) return invoices;
    return invoices.filter(i => {
      const ref = i.dueDate || i.createdAt;
      return monthKey(ref) === selectedKey;
    });
  }, [invoices, selectedKey, viewAllMonths]);

  // Available months (with at least one invoice)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(i => {
      const k = monthKey(i.dueDate || i.createdAt);
      if (k) set.add(k);
    });
    set.add(selectedKey);
    return Array.from(set).sort().reverse();
  }, [invoices, selectedKey]);

  // KPIs (do mês selecionado)
  const kpis = useMemo(() => {
    const pending = invoicesOfMonth.filter(i => i.status === 'pending');
    const paid = invoicesOfMonth.filter(i => i.status === 'paid');
    return {
      totalReceivable: pending.reduce((s, i) => s + i.amount, 0),
      totalReceived: paid.reduce((s, i) => s + i.amount, 0),
      pendingCount: pending.length,
      paidCount: paid.length,
    };
  }, [invoicesOfMonth]);

  // Filtered
  const filtered = useMemo(() => {
    return invoicesOfMonth
      .filter(i => filterStatus === 'all' || i.status === filterStatus)
      .filter(i => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return i.clientName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invoicesOfMonth, filterStatus, searchQuery]);

  const shiftMonth = (delta: number) => {
    setViewAllMonths(false);
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };


  // Create / Edit
  const openCreateModal = () => {
    setEditingInvoice(null);
    setForm({ 
      clientName: '', clientContact: '', description: '', 
      amount: '', dueDate: '', notes: '', customMessage: '',
      installments: '1'
    });
    setShowInvoiceModal(true);
  };

  const openEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setForm({
      clientName: inv.clientName, clientContact: inv.clientContact,
      description: inv.description, amount: inv.amount.toString(),
      dueDate: inv.dueDate, notes: inv.notes, customMessage: inv.customMessage,
      installments: '1'
    });
    setShowInvoiceModal(true);
  };

  const handleSaveInvoice = async () => {
    if (!form.clientName || !form.amount || !form.dueDate) {
      toast.error('Preencha nome, valor e vencimento');
      return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido');
      return;
    }
    if (!pixConfig.pixKey) {
      toast.error('Configure sua chave Pix primeiro', { description: 'Clique em ⚙️ Configurações do Pix' });
      return;
    }

    try {
      const installmentsCount = parseInt(form.installments) || 1;
      const installmentAmount = amount / installmentsCount;
      const baseDate = new Date(form.dueDate + 'T12:00:00');

      if (editingInvoice) {
        const invData = {
          client_name: form.clientName,
          client_contact: form.clientContact,
          description: form.description,
          amount,
          due_date: form.dueDate,
          notes: form.notes,
          custom_message: form.customMessage,
          pix_code: generatePixPayload(pixConfig, amount),
          status: editingInvoice.status === 'paid' ? 'pago' : 'pendente'
        };

        await supabase.from('invoices').update(invData).eq('id', editingInvoice.id);
        const updated = invoices.map(i => i.id === editingInvoice.id ? {
          ...i, clientName: form.clientName, clientContact: form.clientContact,
          description: form.description, amount, dueDate: form.dueDate,
          notes: form.notes, customMessage: form.customMessage
        } : i);
        setInvoices(updated);
        toast.success('Fatura atualizada');
      } else {
        const inserts = [];
        // Parcelas dentro do mesmo mês (facilitação de pagamento)
        const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
        const startDay = baseDate.getDate();
        const availableDays = Math.max(1, monthEnd - startDay);
        const stepDays = installmentsCount > 1 ? Math.floor(availableDays / (installmentsCount - 1)) : 0;
        for (let i = 0; i < installmentsCount; i++) {
          const d = new Date(baseDate);
          const targetDay = Math.min(startDay + stepDays * i, monthEnd);
          d.setDate(targetDay);
          const formattedDate = d.toISOString().split('T')[0];
          
          const desc = installmentsCount > 1 
            ? `${form.description} (${i + 1}/${installmentsCount})`
            : form.description;

          inserts.push({
            id: crypto.randomUUID(),
            client_name: form.clientName,
            client_contact: form.clientContact,
            description: desc,
            amount: installmentAmount,
            due_date: formattedDate,
            notes: form.notes,
            custom_message: form.customMessage,
            pix_code: generatePixPayload(pixConfig, installmentAmount),
            status: 'pendente',
            created_at: new Date().toISOString()
          });
        }

        const { error } = await supabase.from('invoices').insert(inserts);
        if (error) throw error;

        fetchData();
        toast.success(installmentsCount > 1 ? `${installmentsCount} parcelas criadas!` : 'Fatura criada com sucesso!');
      }
      setShowInvoiceModal(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Erro ao salvar fatura no banco de dados');
    }
  };

  const markAsPaid = async (id: string) => {
    const now = new Date().toISOString();
    try {
      await supabase.from('invoices').update({ status: 'pago', paid_at: now }).eq('id', id);
      setInvoices(invoices.map(i => i.id === id ? { ...i, status: 'paid' as const, paidAt: now } : i));
      toast.success('Fatura marcada como paga ✅');
      if (viewingInvoice?.id === id) setViewingInvoice(prev => prev ? { ...prev, status: 'paid', paidAt: now } : null);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const markAsPending = async (id: string) => {
    try {
      await supabase.from('invoices').update({ status: 'pendente', paid_at: null }).eq('id', id);
      setInvoices(invoices.map(i => i.id === id ? { ...i, status: 'pending' as const, paidAt: null } : i));
      toast.success('Fatura marcada como pendente');
      if (viewingInvoice?.id === id) setViewingInvoice(prev => prev ? { ...prev, status: 'pending', paidAt: null } : null);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('Excluir esta fatura?')) return;
    try {
      await supabase.from('invoices').delete().eq('id', id);
      setInvoices(invoices.filter(i => i.id !== id));
      if (viewingInvoice?.id === id) setViewingInvoice(null);
      toast.success('Fatura excluída');
    } catch (error) {
      toast.error('Erro ao excluir fatura');
    }
  };

  const openAutoModal = () => {
    const activeClients = clients.filter(c => c.status === 'Ativo');
    if (activeClients.length === 0) {
      toast.error('Nenhum cliente ativo encontrado.');
      return;
    }
    if (!pixConfig.pixKey) {
      toast.error('Configure sua chave Pix primeiro');
      return;
    }
    setShowAutoModal(true);
  };

  const confirmGenerateAutomaticInvoices = async () => {
    const activeClients = clients.filter(c => c.status === 'Ativo');
    
    const [year, month] = autoMonth.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 1);
    const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    
    try {
      const inserts = activeClients.map(c => ({
        id: crypto.randomUUID(),
        client_name: c.companyName,
        client_contact: c.phone || '',
        description: `Mensalidade - ${capitalizedMonth}`,
        amount: c.monthlyValue,
        due_date: autoDueDate,
        notes: 'Gerada automaticamente via sistema',
        custom_message: 'Agradecemos pela parceria!',
        status: 'pendente',
        pix_code: generatePixPayload(pixConfig, c.monthlyValue),
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('invoices').insert(inserts);
      if (error) throw error;

      fetchData();
      toast.success(`${inserts.length} faturas geradas para ${capitalizedMonth}!`);
      setShowAutoModal(false);
    } catch (error) {
      console.error('Error generating invoices:', error);
      toast.error('Erro ao gerar faturas no banco de dados');
    }
  };

  // PIX helpers
  const getPixPayload = (inv: Invoice) => {
    const txId = inv.id.replace(/-/g, '').substring(0, 25);
    return generatePixPayload(pixConfig, inv.amount, txId);
  };

  const copyPixCode = (inv: Invoice) => {
    const code = getPixPayload(inv);
    navigator.clipboard.writeText(code);
    toast.success('Código Pix copiado!');
  };

  const shareWhatsApp = (inv: Invoice) => {
    const pixCode = getPixPayload(inv);
    const phone = inv.clientContact.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá${inv.clientName ? `, ${inv.clientName}` : ''}! Segue sua fatura:\n\n` +
      `💰 Valor: ${fmtCurrency(inv.amount)}\n` +
      `📅 Vencimento: ${fmtDate(inv.dueDate)}\n` +
      `📋 ${inv.description || 'Serviço'}\n\n` +
      `Para pagar, utilize o código Pix abaixo:\n\n` +
      `${pixCode}\n\n` +
      (inv.customMessage ? `${inv.customMessage}\n\n` : '') +
      `Qualquer dúvida estou à disposição 🙂`
    );
    const url = phone
      ? `https://api.whatsapp.com/send/?phone=${phone}&text=${msg}`
      : `https://api.whatsapp.com/send/?text=${msg}`;
    window.open(url, '_blank');
  };

  const isOverdue = (inv: Invoice) => {
    if (inv.status === 'paid') return false;
    return new Date(inv.dueDate + 'T23:59:59') < new Date();
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Financeiro
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Faturas, cobranças e pagamentos via Pix.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowConfigModal(true)} className="hidden sm:flex">
            <Settings className="mr-2 h-4 w-4" /> Configurar Pix
          </Button>
          <Button variant="secondary" onClick={openAutoModal} className="gap-2">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" /> Gerar Faturas Automáticas
          </Button>
          <Button onClick={openCreateModal} className="shadow-lg shadow-primary/20 transition-all hover:scale-105">
            <Plus className="mr-2 h-4 w-4" /> Nova Fatura
          </Button>
        </div>
      </div>

      {/* Pix Config Alert */}
      {!pixConfig.pixKey && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Configure sua chave Pix</p>
                <p className="text-xs text-muted-foreground">Você precisa cadastrar sua chave Pix antes de criar faturas.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowConfigModal(true)}>
                <Settings className="mr-2 h-3.5 w-3.5" /> Configurar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Navegação por mês */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} disabled={viewAllMonths}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-[200px] justify-center">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold capitalize">
              {viewAllMonths ? 'Todos os meses' : monthLabel(selectedKey)}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} disabled={viewAllMonths}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={viewAllMonths ? 'all' : selectedKey}
            onValueChange={(v) => {
              if (v === 'all') { setViewAllMonths(true); return; }
              setViewAllMonths(false);
              const [y, m] = v.split('-').map(Number);
              setSelectedMonth(new Date(y, m - 1, 1));
            }}
          >
            <SelectTrigger className="w-[200px] h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map(k => (
                <SelectItem key={k} value={k} className="capitalize">{monthLabel(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={viewAllMonths ? 'outline' : 'default'}
            onClick={() => {
              setViewAllMonths(false);
              const d = new Date();
              setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Mês atual
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'A Receber', value: fmtCurrency(kpis.totalReceivable), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Recebido', value: fmtCurrency(kpis.totalReceived), icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pendentes', value: kpis.pendingCount.toString(), icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Pagas', value: kpis.paidCount.toString(), icon: Banknote, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mr-auto">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Faturas</h2>
          <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="w-[130px] h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-primary/40 mb-4" />
          <p className="text-muted-foreground">Sincronizando faturas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhuma fatura encontrada</h3>
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira fatura para começar.</p>
          <Button className="mt-4" onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" /> Nova Fatura
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((inv, i) => {
              const overdue = isOverdue(inv);
              return (
                <motion.div
                  key={inv.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className={`overflow-hidden rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all group hover:-translate-y-0.5 ${
                    inv.status === 'paid' ? 'border-emerald-500/20' : overdue ? 'border-rose-500/20' : ''
                  }`}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-lg truncate">{inv.clientName}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{inv.description || 'Sem descrição'}</p>
                        </div>
                        <Badge className={`ml-2 flex-shrink-0 ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : overdue
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                          {inv.status === 'paid' ? '✅ Pago' : overdue ? '⚠️ Atrasada' : '⏳ Pendente'}
                        </Badge>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-foreground">{fmtCurrency(inv.amount)}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {fmtDate(inv.dueDate)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setViewingInvoice(inv)}>
                          <Eye className="mr-1.5 h-3 w-3" /> Ver
                        </Button>
                        {inv.status === 'pending' ? (
                          <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markAsPaid(inv.id)}>
                            <CheckCircle2 className="mr-1.5 h-3 w-3" /> Marcar pago
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => markAsPending(inv.id)}>
                            <Clock className="mr-1.5 h-3 w-3" /> Pendente
                          </Button>
                        )}
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(inv)}>
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteInvoice(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Create / Edit Invoice Modal ──────────────────────────────────── */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {editingInvoice ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingInvoice ? 'Editar Fatura' : 'Nova Fatura'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm font-semibold">Nome do cliente *</Label>
                <Input value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} placeholder="Ex: João Silva" className="h-11" />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm font-semibold">Contato (WhatsApp)</Label>
                <Input value={form.clientContact} onChange={e => setForm({...form, clientContact: e.target.value})} placeholder="5511999999999" className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Descrição do serviço</Label>
              <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Produção de 10 vídeos" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="1500.00" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Vencimento *</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Observações (internas)</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notas internas sobre esta fatura..." rows={2} className="resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Parcelamento</Label>
                <Select 
                  disabled={!!editingInvoice}
                  value={form.installments} 
                  onValueChange={v => setForm({...form, installments: v})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Parcelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <SelectItem key={n} value={n.toString()}>
                        {n === 1 ? 'À vista' : `${n} parcelas`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {parseInt(form.installments) > 1 && (
                  <p className="text-[10px] text-amber-600 font-medium mt-1">
                    Serão geradas {form.installments} faturas dentro do mesmo mês (facilitação) de {fmtCurrency((parseFloat(form.amount) || 0) / (parseInt(form.installments) || 1))} cada
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5 border-t pt-4">
              <Label className="text-sm font-semibold">Mensagem personalizada para o cliente</Label>
              <Textarea value={form.customMessage} onChange={e => setForm({...form, customMessage: e.target.value})} placeholder="Ex: Agradecemos pela confiança! Qualquer dúvida, estamos à disposição." rows={2} className="resize-none" />
              <p className="text-[11px] text-muted-foreground">Será exibida na fatura e no WhatsApp.</p>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setShowInvoiceModal(false)} className="mr-auto">Cancelar</Button>
            <Button onClick={handleSaveInvoice} size="lg" className="w-36">
              {editingInvoice ? 'Salvar' : 'Criar Fatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Auto Generate Invoices Modal ─────────────────────────────────── */}
      <Dialog open={showAutoModal} onOpenChange={setShowAutoModal}>
        <DialogContent className="sm:max-w-[420px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" /> Gerar Faturas Automáticas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Serão geradas faturas para {clients.filter(c => c.status === 'Ativo').length} clientes ativos.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Mês de Referência</Label>
              <Input type="month" value={autoMonth} onChange={e => setAutoMonth(e.target.value)} className="h-11" />
              <p className="text-[11px] text-muted-foreground">Aparecerá na descrição: "Mensalidade - [Mês]"</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Data de Vencimento Base</Label>
              <Input type="date" value={autoDueDate} onChange={e => setAutoDueDate(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setShowAutoModal(false)} className="mr-auto">Cancelar</Button>
            <Button onClick={confirmGenerateAutomaticInvoices} size="lg" className="w-36 bg-amber-500 hover:bg-amber-600 text-white">
              Gerar Faturas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Pix Config Modal ─────────────────────────────────────────────── */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="sm:max-w-[460px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" /> Configurações do Pix
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo de chave Pix</Label>
              <Select value={pixConfig.keyType} onValueChange={(v: any) => setPixConfig({...pixConfig, keyType: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Chave Pix *</Label>
              <Input
                value={pixConfig.pixKey}
                onChange={e => setPixConfig({...pixConfig, pixKey: e.target.value})}
                placeholder={pixConfig.keyType === 'cpf' ? '000.000.000-00' : pixConfig.keyType === 'email' ? 'email@exemplo.com' : pixConfig.keyType === 'phone' ? '+5511999999999' : 'uuid-da-chave'}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nome do recebedor *</Label>
              <Input value={pixConfig.receiverName} onChange={e => setPixConfig({...pixConfig, receiverName: e.target.value})} placeholder="Seu nome completo" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Cidade</Label>
              <Input value={pixConfig.city} onChange={e => setPixConfig({...pixConfig, city: e.target.value})} placeholder="Ex: Goiânia" className="h-11" />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setShowConfigModal(false)} className="mr-auto">Cancelar</Button>
            <Button onClick={() => { savePixConfig(pixConfig); setShowConfigModal(false); toast.success('Configurações do Pix salvas!'); }} size="lg" className="w-28">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Invoice Modal (with QR Code) ───────────────────────────── */}
      <Dialog open={!!viewingInvoice} onOpenChange={v => { if (!v) setViewingInvoice(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[95vh] overflow-y-auto shadow-2xl p-0">
          {viewingInvoice && (() => {
            const inv = viewingInvoice;
            const pixPayload = pixConfig.pixKey ? getPixPayload(inv) : '';
            const overdue = isOverdue(inv);

            return (
              <>
                {/* Header gradient */}
                <div className={`px-6 pt-6 pb-5 ${inv.status === 'paid' ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5' : 'bg-gradient-to-br from-amber-500/10 to-orange-500/5'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={`${inv.status === 'paid' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25' : overdue ? 'bg-rose-500/15 text-rose-600 border-rose-500/25' : 'bg-amber-500/15 text-amber-600 border-amber-500/25'} text-sm px-3 py-1`}>
                      {inv.status === 'paid' ? '✅ Pago' : overdue ? '⚠️ Atrasada' : '⏳ Pendente'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">#{inv.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{inv.clientName}</h2>
                  {inv.description && <p className="text-sm text-muted-foreground mt-1">{inv.description}</p>}
                </div>

                <div className="px-6 pb-6 space-y-6">
                  {/* Amount & Date */}
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="rounded-xl bg-muted/30 p-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Valor</p>
                      <p className="text-2xl font-bold text-foreground">{fmtCurrency(inv.amount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Vencimento</p>
                      <p className="text-2xl font-bold text-foreground">{fmtDate(inv.dueDate)}</p>
                    </div>
                  </div>

                  {/* Custom Message */}
                  {inv.customMessage && (
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                      <p className="text-sm text-foreground leading-relaxed">{inv.customMessage}</p>
                    </div>
                  )}

                  {/* QR Code Section */}
                  {pixConfig.pixKey && inv.status === 'pending' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Pagamento via Pix</h3>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="bg-white p-5 rounded-2xl shadow-lg">
                          <QRCodeSVG
                            value={pixPayload}
                            size={220}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      </div>

                      {/* Copy & Paste Code */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Pix Copia e Cola</Label>
                        <div className="flex gap-2">
                          <Input value={pixPayload} readOnly className="h-10 text-xs font-mono bg-muted/30" />
                          <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => copyPixCode(inv)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Receiver Info */}
                      <div className="rounded-xl bg-muted/20 p-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between"><span>Recebedor:</span><span className="font-medium text-foreground">{pixConfig.receiverName}</span></div>
                        <div className="flex justify-between"><span>Chave ({KEY_TYPE_LABELS[pixConfig.keyType]}):</span><span className="font-medium text-foreground">{pixConfig.pixKey}</span></div>
                        {pixConfig.city && <div className="flex justify-between"><span>Cidade:</span><span className="font-medium text-foreground">{pixConfig.city}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* Paid confirmation */}
                  {inv.status === 'paid' && (
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      </div>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">Pagamento confirmado</p>
                      {inv.paidAt && <p className="text-xs text-muted-foreground mt-1">Em {new Date(inv.paidAt).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                    {inv.status === 'pending' && (
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => markAsPaid(inv.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como pago
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1" onClick={() => shareWhatsApp(inv)}>
                      <Send className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                    </Button>
                    {inv.status === 'pending' && (
                      <Button variant="outline" className="flex-1" onClick={() => copyPixCode(inv)}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar Pix
                      </Button>
                    )}
                  </div>

                  {/* Notes */}
                  {inv.notes && (
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      <span className="font-semibold">Observações internas:</span> {inv.notes}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
