import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import logoInova from '@/assets/logo-inova.png';

type InvoicePdfData = {
  id: string;
  client_name: string;
  client_contact?: string;
  description?: string;
  amount: number;
  due_date?: string | null;
  status: 'pendente' | 'pago';
  custom_message?: string;
  pix_code: string;
  created_at?: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePdf(inv: InvoicePdfData, publicUrl: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;

  // Header bar
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 38, 'F');

  // Logo
  try {
    const logoData = await loadImageAsDataUrl(logoInova);
    doc.addImage(logoData, 'PNG', margin, 10, 36, 18, undefined, 'FAST');
  } catch {
    // ignore logo errors
  }

  // Title on right
  doc.setTextColor(191, 247, 32); // #BFF720
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('FATURA', pageW - margin, 20, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`#${inv.id.slice(0, 8).toUpperCase()}`, pageW - margin, 28, { align: 'right' });

  // Body
  let y = 52;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COBRADO DE', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(inv.client_name || '-', margin, y + 6);
  if (inv.client_contact) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(inv.client_contact, margin, y + 12);
  }

  // Status / dates on right
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STATUS', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  if (inv.status === 'pago') {
    doc.setTextColor(34, 139, 34);
    doc.text('PAGO', pageW - margin, y + 6, { align: 'right' });
  } else {
    doc.setTextColor(217, 119, 6);
    doc.text('PENDENTE', pageW - margin, y + 6, { align: 'right' });
  }
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  if (inv.created_at) {
    doc.text(
      `Emitida: ${new Date(inv.created_at).toLocaleDateString('pt-BR')}`,
      pageW - margin,
      y + 12,
      { align: 'right' }
    );
  }
  if (inv.due_date) {
    doc.text(
      `Vencimento: ${new Date(inv.due_date + 'T00:00').toLocaleDateString('pt-BR')}`,
      pageW - margin,
      y + 17,
      { align: 'right' }
    );
  }

  // Description
  y = 80;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DESCRIÇÃO', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const descLines = doc.splitTextToSize(inv.description || 'Serviço prestado', pageW - margin * 2);
  doc.text(descLines, margin, y + 6);
  y += 6 + descLines.length * 5 + 6;

  // Total box
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('VALOR TOTAL', margin + 6, y + 9);
  doc.setTextColor(191, 247, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(formatBRL(Number(inv.amount)), pageW - margin - 6, y + 14, { align: 'right' });
  y += 32;

  // Pix section (only if pendente and pix code)
  if (inv.status !== 'pago' && inv.pix_code) {
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PAGAMENTO VIA PIX', margin, y);
    y += 6;

    const qrDataUrl = await QRCode.toDataURL(inv.pix_code, {
      margin: 1,
      width: 400,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    doc.addImage(qrDataUrl, 'PNG', margin, y, 45, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Escaneie o QR Code com o app do seu banco', margin + 50, y + 6);
    doc.text('ou copie o código Pix abaixo:', margin + 50, y + 11);

    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    const pixLines = doc.splitTextToSize(inv.pix_code, pageW - margin - (margin + 50));
    doc.text(pixLines.slice(0, 8), margin + 50, y + 18);

    y += 52;
  }

  // Custom message
  if (inv.custom_message) {
    doc.setFillColor(245, 245, 245);
    const msgLines = doc.splitTextToSize(inv.custom_message, pageW - margin * 2 - 8);
    const boxH = 8 + msgLines.length * 5;
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 2, 2, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(msgLines, margin + 4, y + 6);
    y += boxH + 6;
  }

  // Public link
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Acompanhe online: ${publicUrl}`, margin, y + 4);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text('INOVA Co. — Marketing & Audiovisual', margin, footerY);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageW - margin,
    footerY,
    { align: 'right' }
  );

  doc.save(`fatura-${inv.client_name.replace(/\s+/g, '_')}-${inv.id.slice(0, 8)}.pdf`);
}
