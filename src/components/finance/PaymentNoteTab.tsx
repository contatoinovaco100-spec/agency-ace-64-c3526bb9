import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Send, Plus, Trash2, RotateCcw, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAgency } from '@/contexts/AgencyContext';
import { generatePixPayload } from '@/lib/pix';
import {
  generatePaymentNotePdf, paymentNoteTotal, PAYMENT_NOTE_TITLES,
  type PaymentNoteData, type PaymentNoteItem, type PaymentNoteKind,
} from '@/lib/paymentNotePdf';
import { cn } from '@/lib/utils';

export interface PaymentNotePix {
  pixKey: string;
  receiverName: string;
  city: string;
}

const PAYMENT_METHODS = ['Pix', 'Transferência bancária', 'Boleto', 'Cartão', 'Dinheiro'];
const HISTORY_KEY = 'inova:payment-notes';
const HISTORY_MAX = 20;

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const NUMBER_PREFIX: Record<PaymentNoteKind, string> = { cobranca: 'NC', comprovante: 'RC' };
const KIND_OPTIONS: { value: PaymentNoteKind; label: string; hint: string }[] = [
  { value: 'cobranca', label: 'Cobrança', hint: 'Pedir um pagamento' },
  { value: 'comprovante', label: 'Comprovante', hint: 'Confirmar que recebeu' },
];
const newNumber = (kind: PaymentNoteKind) => `${NUMBER_PREFIX[kind]}-${today().replace(/-/g, '').slice(2)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

type FormItem = { description: string; quantity: string; unitPrice: string };
type NoteForm = {
  kind: PaymentNoteKind;
  number: string;
  issueDate: string;
  dueDate: string;
  paidDate: string;
  clientId: string;
  clientName: string;
  clientDocument: string;
  clientContact: string;
  items: FormItem[];
  paymentMethod: string;
  notes: string;
};
type SavedNote = NoteForm & { savedAt: string; total: number };

const emptyItem = (): FormItem => ({ description: '', quantity: '1', unitPrice: '' });
const emptyForm = (kind: PaymentNoteKind = 'cobranca'): NoteForm => ({
  kind, number: newNumber(kind), issueDate: today(), dueDate: '', paidDate: today(),
  clientId: '', clientName: '', clientDocument: '', clientContact: '',
  items: [emptyItem()], paymentMethod: 'Pix', notes: '',
});

const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;

function readHistory(): SavedNote[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(list: SavedNote[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    // histórico é só conveniência local
  }
}

export function PaymentNoteTab({ pix }: { pix: PaymentNotePix }) {
  const { clients } = useAgency();
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [history, setHistory] = useState<SavedNote[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { setHistory(readHistory()); }, []);

  const items: PaymentNoteItem[] = useMemo(
    () => form.items
      .filter(i => i.description.trim() || parseNum(i.unitPrice) > 0)
      .map(i => ({ description: i.description.trim(), quantity: parseNum(i.quantity) || 1, unitPrice: parseNum(i.unitPrice) })),
    [form.items],
  );
  const total = paymentNoteTotal(items);
  const isReceipt = form.kind === 'comprovante';
  const usesPix = !isReceipt && form.paymentMethod === 'Pix';
  const pixReady = usesPix && !!pix.pixKey && total > 0;
  const pixCode = useMemo(
    () => pixReady
      ? generatePixPayload({ pixKey: pix.pixKey, receiverName: pix.receiverName, city: pix.city, amount: total, txid: form.number.replace(/-/g, '') })
      : '',
    [pixReady, pix, total, form.number],
  );

  const setItem = (idx: number, patch: Partial<FormItem>) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const removeItem = (idx: number) =>
    setForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : [emptyItem()] }));

  const validate = () => {
    if (!form.clientName.trim()) { toast.error('Informe o cliente'); return false; }
    if (items.length === 0 || total <= 0) { toast.error('Adicione ao menos um item com valor'); return false; }
    return true;
  };

  const remember = () => {
    const entry: SavedNote = { ...form, savedAt: new Date().toISOString(), total };
    const next = [entry, ...history.filter(h => h.number !== form.number)];
    setHistory(next);
    writeHistory(next);
  };

  const setKind = (kind: PaymentNoteKind) => setForm(f => ({
    ...f,
    kind,
    // troca o prefixo do número gerado (NC-/RC-) sem mexer em número digitado à mão
    number: /^(NC|RC|NP)-/.test(f.number) ? f.number.replace(/^(NC|RC|NP)-/, `${NUMBER_PREFIX[kind]}-`) : f.number,
    paidDate: f.paidDate || today(),
  }));

  const toPdfData = (): PaymentNoteData => ({
    kind: form.kind,
    number: form.number,
    issueDate: form.issueDate || today(),
    dueDate: !isReceipt ? form.dueDate || undefined : undefined,
    paidDate: isReceipt ? form.paidDate || undefined : undefined,
    clientName: form.clientName.trim(),
    clientDocument: form.clientDocument.trim() || undefined,
    clientContact: form.clientContact.trim() || undefined,
    items,
    paymentMethod: form.paymentMethod,
    notes: form.notes.trim() || undefined,
    pixCode: pixCode || undefined,
    pixReceiver: pixCode ? pix.receiverName : undefined,
    pixKey: pixCode ? pix.pixKey : undefined,
  });

  const downloadPdf = async () => {
    if (!validate()) return;
    setGenerating(true);
    try {
      await generatePaymentNotePdf(toPdfData());
      remember();
      toast.success(isReceipt ? 'Comprovante gerado!' : 'Nota de cobrança gerada!');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    } finally {
      setGenerating(false);
    }
  };

  const shareWhatsApp = () => {
    if (!validate()) return;
    const phone = form.clientContact.replace(/\D/g, '');
    const lines = items.map(i => `• ${i.description || 'Serviço'}${i.quantity !== 1 ? ` (${i.quantity}x)` : ''}: ${fmtCurrency(i.quantity * i.unitPrice)}`);
    const hello = `Olá${form.clientName ? `, ${form.clientName}` : ''}!`;
    const msg = isReceipt
      ? `${hello} Confirmamos o recebimento do seu pagamento ✅\n\n` +
        `🧾 Comprovante ${form.number}\n` +
        `${lines.join('\n')}\n\n` +
        `💰 Valor recebido: ${fmtCurrency(total)}\n` +
        (form.paidDate ? `📅 Pago em: ${fmtDate(form.paidDate)}\n` : '') +
        `💳 Pago via: ${form.paymentMethod}\n` +
        (form.notes.trim() ? `\n${form.notes.trim()}\n` : '') +
        `\nObrigado pela parceria! 🙌`
      : `${hello} Segue a nota de cobrança ${form.number}:\n\n` +
        `${lines.join('\n')}\n\n` +
        `💰 Valor a pagar: ${fmtCurrency(total)}\n` +
        (form.dueDate ? `📅 Vencimento: ${fmtDate(form.dueDate)}\n` : '') +
        `💳 Forma de pagamento: ${form.paymentMethod}\n` +
        (pixCode ? `\nChave Pix: ${pix.pixKey}\nPix copia e cola:\n${pixCode}\n` : '') +
        (form.notes.trim() ? `\n${form.notes.trim()}\n` : '') +
        `\nQualquer dúvida estou à disposição 🙂`;
    const text = encodeURIComponent(msg);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
    remember();
  };

  const reopen = (note: SavedNote) => {
    const { savedAt: _s, total: _t, ...rest } = note;
    // notas salvas antes dos dois tipos não têm kind/paidDate
    setForm({ ...emptyForm(), ...rest, kind: rest.kind || 'cobranca', paidDate: rest.paidDate || today() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const forget = (number: string) => {
    const next = history.filter(h => h.number !== number);
    setHistory(next);
    writeHistory(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Formulário */}
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-5">
            <div className="space-y-1.5">
              <Label>Tipo de nota</Label>
              <div role="radiogroup" aria-label="Tipo de nota" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {KIND_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === opt.value}
                    onClick={() => setKind(opt.value)}
                    className={cn(
                      'rounded-md px-3 py-2 text-left transition-colors active:scale-[0.97]',
                      form.kind === opt.value ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="block text-sm font-semibold">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Emissão</Label>
                <Input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cliente cadastrado</Label>
              <Select
                value={form.clientId || 'none'}
                onValueChange={v => {
                  if (v === 'none') { setForm({ ...form, clientId: '' }); return; }
                  const c = clients.find(cl => cl.id === v);
                  if (c) setForm({ ...form, clientId: c.id, clientName: c.companyName || c.contactName, clientContact: c.phone || c.email || '' });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione ou preencha abaixo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cliente avulso (preencher abaixo)</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}{c.contactName ? ` · ${c.contactName}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome do cliente *</Label>
                <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value, clientId: '' })} placeholder="Ex: Padaria Bom Dia" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input value={form.clientDocument} onChange={e => setForm({ ...form, clientDocument: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp ou e-mail</Label>
                <Input value={form.clientContact} onChange={e => setForm({ ...form, clientContact: e.target.value })} placeholder="5511999999999" />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}>
                  <Plus className="h-4 w-4 mr-1.5" /> Item
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_72px_120px_auto] sm:items-end sm:border-0 sm:p-0">
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      {idx === 0 && <span className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Descrição</span>}
                      <Input value={it.description} onChange={e => setItem(idx, { description: e.target.value })} placeholder="Ex: Gravação de 4 vídeos" aria-label="Descrição do item" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      <div className="space-y-1">
                        {idx === 0 && <span className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Qtd</span>}
                        <Input type="number" min="1" step="1" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} aria-label="Quantidade" className="tabular-nums" />
                      </div>
                      <div className="space-y-1">
                        {idx === 0 && <span className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Valor (R$)</span>}
                        <Input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => setItem(idx, { unitPrice: e.target.value })} placeholder="0,00" aria-label="Valor unitário" className="tabular-nums" />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 self-end row-start-2 col-start-2 sm:row-auto sm:col-auto" onClick={() => removeItem(idx)} aria-label="Remover item">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {isReceipt ? (
                <div className="space-y-1.5">
                  <Label>Data do pagamento</Label>
                  <Input type="date" value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{isReceipt ? 'Pago via' : 'Forma de pagamento'}</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {usesPix && !pix.pixKey && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-warning" /> Configure a chave Pix para incluir o QR Code na nota.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Observações para o cliente</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Dados bancários, condições, agradecimento..." className="resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Resumo e ações */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{PAYMENT_NOTE_TITLES[form.kind]}</p>
                  <p className="font-mono text-sm text-foreground/80">{form.number}</p>
                </div>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                  isReceipt ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                )}>
                  {isReceipt ? 'Pago' : 'Em aberto'}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{isReceipt ? 'Recebemos de' : 'Para'}</p>
                <p className="font-medium text-foreground truncate">{form.clientName || '—'}</p>
              </div>
              <div className="space-y-1.5 border-t border-border pt-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
                ) : items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-3 text-sm">
                    <span className="text-foreground/80 min-w-0 truncate">{i.description || 'Serviço'}{i.quantity !== 1 ? ` × ${i.quantity}` : ''}</span>
                    <span className="tabular-nums text-foreground">{fmtCurrency(i.quantity * i.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-end justify-between border-t border-border pt-3">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{isReceipt ? 'Valor recebido' : 'Valor a pagar'}</p>
                  <p>{isReceipt ? 'Pago via' : 'Via'} {form.paymentMethod}</p>
                  {isReceipt
                    ? form.paidDate && <p>Pago em {fmtDate(form.paidDate)}</p>
                    : form.dueDate && <p>Vence {fmtDate(form.dueDate)}</p>}
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{fmtCurrency(total)}</p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={downloadPdf} disabled={generating} className="active:scale-[0.97]">
                  <FileDown className="h-4 w-4 mr-2" /> {generating ? 'Gerando...' : 'Baixar PDF'}
                </Button>
                <Button variant="outline" onClick={shareWhatsApp} className="active:scale-[0.97]">
                  <Send className="h-4 w-4 mr-2" /> Enviar pelo WhatsApp
                </Button>
                <Button variant="ghost" onClick={() => setForm(emptyForm(form.kind))}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Nova nota
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isReceipt
                  ? 'O WhatsApp leva a confirmação do pagamento; anexe o PDF do comprovante na conversa.'
                  : `O WhatsApp leva o valor a pagar${usesPix && pix.pixKey ? ', a chave e o Pix copia e cola' : ''}; anexe o PDF baixado na conversa.`}
                <span className="block mt-1">Documento sem valor fiscal.</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico local */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">Notas recentes</h3>
            <p className="text-xs text-muted-foreground">Ficam salvas só neste navegador.</p>
          </div>
          <div className="grid gap-2">
            {history.map(h => (
              <div key={h.number} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
                <FileText className="hidden sm:block h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{h.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.kind === 'comprovante' ? 'Comprovante' : 'Cobrança'} · <span className="font-mono">{h.number}</span> · {new Date(h.savedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mr-auto sm:mr-2 font-semibold tabular-nums text-foreground">{fmtCurrency(h.total)}</span>
                  <Button size="sm" variant="outline" onClick={() => reopen(h)}>Abrir</Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => forget(h.number)} aria-label="Remover do histórico">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
