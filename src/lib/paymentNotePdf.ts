import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import logoInova from '@/assets/logo-inova.png';
import { loadImageAsDataUrl } from '@/lib/invoicePdf';

export type PaymentNoteItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

/** cobranca = pedido de pagamento; comprovante = recibo de valor já recebido */
export type PaymentNoteKind = 'cobranca' | 'comprovante';

export const PAYMENT_NOTE_TITLES: Record<PaymentNoteKind, string> = {
  cobranca: 'Nota de cobrança',
  comprovante: 'Comprovante de pagamento',
};

export type PaymentNoteData = {
  kind: PaymentNoteKind;
  number: string;
  issueDate: string; // yyyy-mm-dd
  dueDate?: string;
  /** data em que o pagamento foi recebido (comprovante) */
  paidDate?: string;
  clientName: string;
  clientDocument?: string;
  clientContact?: string;
  items: PaymentNoteItem[];
  paymentMethod: string;
  notes?: string;
  /** Pix copia e cola; só aparece quando a forma de pagamento é Pix */
  pixCode?: string;
  pixReceiver?: string;
  pixKey?: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('pt-BR');

export const paymentNoteTotal = (items: PaymentNoteItem[]) =>
  items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

export async function generatePaymentNotePdf(note: PaymentNoteData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const isReceipt = note.kind === 'comprovante';
  const total = paymentNoteTotal(note.items);

  // Header bar
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 38, 'F');
  try {
    const logoData = await loadImageAsDataUrl(logoInova);
    doc.addImage(logoData, 'PNG', margin, 10, 36, 18, undefined, 'FAST');
  } catch {
    // ignore logo errors
  }
  doc.setTextColor(191, 247, 32); // #BFF720
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isReceipt ? 16 : 18);
  doc.text(PAYMENT_NOTE_TITLES[note.kind].toUpperCase(), pageW - margin, 19, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nº ${note.number}`, pageW - margin, 27, { align: 'right' });

  // Client + dates
  let y = 52;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isReceipt ? 'RECEBEMOS DE' : 'COBRADO DE', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(note.clientName || '-', margin, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  let clientY = y + 12;
  if (note.clientDocument) { doc.text(note.clientDocument, margin, clientY); clientY += 5; }
  if (note.clientContact) { doc.text(note.clientContact, margin, clientY); clientY += 5; }

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text('EMISSÃO', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(note.issueDate), pageW - margin, y + 6, { align: 'right' });
  const sideDate = isReceipt ? note.paidDate : note.dueDate;
  if (sideDate) {
    doc.setFont('helvetica', 'bold');
    doc.text(isReceipt ? 'PAGO EM' : 'VENCIMENTO', pageW - margin, y + 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(sideDate), pageW - margin, y + 19, { align: 'right' });
  }
  // Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const status = isReceipt ? 'PAGO' : 'EM ABERTO';
  const statusW = doc.getTextWidth(status) + 8;
  const statusY = y + (sideDate ? 24 : 11);
  if (isReceipt) doc.setFillColor(34, 139, 34); else doc.setFillColor(217, 119, 6);
  doc.roundedRect(pageW - margin - statusW, statusY, statusW, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(status, pageW - margin - statusW / 2, statusY + 4.9, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // Declaração do recibo
  if (isReceipt) {
    y = Math.max(clientY, statusY + 7) + 6;
    const ref = note.items.map(i => i.description || 'Serviço').join('; ');
    const declaration =
      `Declaramos que recebemos de ${note.clientName || '-'} a importância de ${formatBRL(total)}` +
      `${note.paidDate ? ` em ${formatDate(note.paidDate)}` : ''}, via ${note.paymentMethod}, referente a: ${ref}.`;
    const declLines = doc.splitTextToSize(declaration, contentW);
    doc.setTextColor(20, 20, 20);
    doc.text(declLines, margin, y + 4);
    clientY = y + 4 + declLines.length * 5;
  }

  // Items table
  y = Math.max(clientY, isReceipt ? 0 : y + 32) + 4;
  const colQty = pageW - margin - 70;
  const colUnit = pageW - margin - 36;
  const colTotal = pageW - margin - 2;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('DESCRIÇÃO', margin + 2, y + 5.5);
  doc.text('QTD', colQty, y + 5.5, { align: 'right' });
  doc.text('VALOR UNIT.', colUnit, y + 5.5, { align: 'right' });
  doc.text('TOTAL', colTotal, y + 5.5, { align: 'right' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor(225, 225, 225);
  for (const item of note.items) {
    const lines = doc.splitTextToSize(item.description || 'Serviço', colQty - margin - 22);
    const rowH = Math.max(8, 3 + lines.length * 5);
    if (y + rowH > pageH - 70) { doc.addPage(); y = margin; }
    doc.setTextColor(20, 20, 20);
    doc.text(lines, margin + 2, y + 5.5);
    doc.text(String(item.quantity), colQty, y + 5.5, { align: 'right' });
    doc.text(formatBRL(Number(item.unitPrice) || 0), colUnit, y + 5.5, { align: 'right' });
    doc.text(formatBRL((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), colTotal, y + 5.5, { align: 'right' });
    y += rowH;
    doc.line(margin, y, pageW - margin, y);
  }

  // Total box
  y += 6;
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(isReceipt ? 'VALOR RECEBIDO' : 'VALOR A PAGAR', margin + 6, y + 9);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`${isReceipt ? 'Pago via' : 'Forma de pagamento'}: ${note.paymentMethod}`, margin + 6, y + 15);
  doc.setTextColor(191, 247, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(formatBRL(total), pageW - margin - 6, y + 14, { align: 'right' });
  y += 32;

  // Pix (só na cobrança)
  if (!isReceipt && note.pixCode) {
    if (y + 55 > pageH - 20) { doc.addPage(); y = margin; }
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PAGAMENTO VIA PIX', margin, y);
    y += 6;
    const qrDataUrl = await QRCode.toDataURL(note.pixCode, {
      margin: 1, width: 400, color: { dark: '#000000', light: '#FFFFFF' },
    });
    doc.addImage(qrDataUrl, 'PNG', margin, y, 45, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    let infoY = y + 6;
    if (note.pixReceiver) { doc.text(`Recebedor: ${note.pixReceiver}`, margin + 50, infoY); infoY += 5; }
    if (note.pixKey) { doc.text(`Chave Pix: ${note.pixKey}`, margin + 50, infoY); infoY += 5; }
    doc.text('Escaneie o QR Code ou copie o código abaixo:', margin + 50, infoY + 2);
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    const pixLines = doc.splitTextToSize(note.pixCode, pageW - margin - (margin + 50));
    doc.text(pixLines.slice(0, 8), margin + 50, infoY + 8);
    y += 52;
  }

  // Notes
  if (note.notes) {
    const msgLines = doc.splitTextToSize(note.notes, contentW - 8);
    const boxH = 13 + msgLines.length * 5;
    if (y + boxH > pageH - 20) { doc.addPage(); y = margin; }
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OBSERVAÇÕES', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(msgLines, margin + 4, y + 12);
  }

  // Footer
  const footerY = pageH - 14;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text('INOVA Co. — Marketing & Audiovisual · Documento sem valor fiscal', margin, footerY);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW - margin, footerY, { align: 'right' });

  doc.save(`${isReceipt ? 'comprovante' : 'cobranca'}-${(note.clientName || 'cliente').replace(/\s+/g, '_')}-${note.number}.pdf`);
}
