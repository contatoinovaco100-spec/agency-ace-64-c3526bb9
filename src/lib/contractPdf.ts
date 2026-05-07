import jsPDF from 'jspdf';
import logoInova from '@/assets/logo-inova.png';

export type ContractPdfData = {
  id: string;
  title: string;
  contractor_name: string;
  contractor_cpf_cnpj: string;
  contractor_address: string;
  client_name: string;
  client_cpf_cnpj: string;
  client_email: string;
  client_address: string;
  services: string;
  scope_description: string;
  monthly_value: number;
  duration_months: number;
  payment_due_day: number;
  additional_clauses: string;
  plan_name: string;
  deliverables: { label: string; quantity: string }[];
  status: string;
  created_at?: string;
};

export type ContractSignaturePdf = {
  signer_name: string;
  signer_cpf: string;
  signer_email?: string;
  signed_at: string;
  ip_address?: string;
  signature_hash?: string;
};

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function generateContractPdf(
  c: ContractPdfData,
  signature: ContractSignaturePdf | null,
  publicUrl: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 22) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 38, 'F');
  try {
    const logoData = await loadImageAsDataUrl(logoInova);
    doc.addImage(logoData, 'PNG', margin, 10, 36, 18, undefined, 'FAST');
  } catch {}
  doc.setTextColor(191, 247, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CONTRATO', pageW - margin, 20, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`#${c.id.slice(0, 8).toUpperCase()}`, pageW - margin, 28, { align: 'right' });

  y = 48;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(c.title || 'Contrato de Prestação de Serviços', contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6 + 4;

  // Status badge
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (c.status === 'assinado') {
    doc.setFillColor(220, 252, 231);
    doc.setTextColor(22, 101, 52);
  } else if (c.status === 'enviado') {
    doc.setFillColor(219, 234, 254);
    doc.setTextColor(30, 64, 175);
  } else {
    doc.setFillColor(243, 244, 246);
    doc.setTextColor(75, 85, 99);
  }
  const statusLabel = c.status.toUpperCase();
  const statusW = doc.getTextWidth(statusLabel) + 6;
  doc.roundedRect(margin, y, statusW, 6, 1.5, 1.5, 'F');
  doc.text(statusLabel, margin + 3, y + 4.2);
  y += 12;

  // Two columns: parties
  const colW = (contentW - 6) / 2;
  const drawParty = (x: number, header: string, name: string, doc_id: string, addr: string, email?: string) => {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(header, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(name || '-', x, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    let yy = y + 11;
    if (doc_id) { doc.text(`CPF/CNPJ: ${doc_id}`, x, yy); yy += 4.5; }
    if (email) { doc.text(`Email: ${email}`, x, yy); yy += 4.5; }
    if (addr) {
      const addrLines = doc.splitTextToSize(`Endereço: ${addr}`, colW);
      doc.text(addrLines, x, yy);
    }
  };
  drawParty(margin, 'CONTRATANTE (PRESTADOR)', c.contractor_name, c.contractor_cpf_cnpj, c.contractor_address);
  drawParty(margin + colW + 6, 'CONTRATADO (CLIENTE)', c.client_name, c.client_cpf_cnpj, c.client_address, c.client_email);
  y += 36;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Clauses helper
  const section = (title: string, body: string) => {
    if (!body?.trim()) return;
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(title, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(body, contentW);
    lines.forEach((line: string) => {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.8;
    });
    y += 4;
  };

  section('1. OBJETO', `O presente contrato tem por objeto a prestação de serviços de ${c.services || 'marketing e audiovisual'} pelo CONTRATANTE ao CONTRATADO, conforme o ${c.plan_name || 'plano contratado'}.`);

  if (c.scope_description) section('2. ESCOPO', c.scope_description);

  // Deliverables table
  if (c.deliverables?.length) {
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('3. ENTREGÁVEIS MENSAIS', margin, y);
    y += 6;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(9);
    doc.text('Item', margin + 3, y + 5);
    doc.text('Qtd', pageW - margin - 15, y + 5);
    y += 7;
    doc.setFont('helvetica', 'normal');
    c.deliverables.forEach((d, i) => {
      ensureSpace(8);
      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentW, 6.5, 'F');
      }
      doc.setTextColor(40, 40, 40);
      const lbl = doc.splitTextToSize(d.label || '', contentW - 25);
      doc.text(lbl[0] || '', margin + 3, y + 4.5);
      doc.text(String(d.quantity || ''), pageW - margin - 15, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  section(
    '4. VALOR E PAGAMENTO',
    `O valor mensal do contrato é de ${formatBRL(c.monthly_value)}, com vencimento todo dia ${c.payment_due_day} de cada mês. O contrato terá vigência de ${c.duration_months} meses a partir da assinatura.`,
  );

  if (c.additional_clauses) section('5. CLÁUSULAS ADICIONAIS', c.additional_clauses);

  section(
    '6. FORO',
    'As partes elegem o foro da comarca do CONTRATANTE para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
  );

  // Signature block
  ensureSpace(50);
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSINATURA', margin, y);
  y += 6;

  if (signature) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(34, 139, 34);
    doc.text('✓ Contrato assinado digitalmente', margin, y);
    y += 6;
    doc.setTextColor(40, 40, 40);
    doc.text(`Assinante: ${signature.signer_name}`, margin, y); y += 5;
    doc.text(`CPF: ${signature.signer_cpf}`, margin, y); y += 5;
    if (signature.signer_email) { doc.text(`Email: ${signature.signer_email}`, margin, y); y += 5; }
    doc.text(`Data: ${new Date(signature.signed_at).toLocaleString('pt-BR')}`, margin, y); y += 5;
    if (signature.ip_address) { doc.text(`IP: ${signature.ip_address}`, margin, y); y += 5; }
    if (signature.signature_hash) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Hash SHA-256: ${signature.signature_hash}`, margin, y, { maxWidth: contentW });
      y += 5;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Aguardando assinatura digital do cliente.', margin, y);
    y += 16;
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageW - margin - 70, y, pageW - margin, y);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Contratante', margin, y + 4);
    doc.text('Contratado', pageW - margin - 70, y + 4);
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const fy = pageH - 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, fy - 4, pageW - margin, fy - 4);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('INOVA Co. — Marketing & Audiovisual', margin, fy);
    doc.text(`Página ${i} de ${pageCount}`, pageW / 2, fy, { align: 'center' });
    doc.text(publicUrl, pageW - margin, fy, { align: 'right' });
  }

  doc.save(`contrato-${(c.client_name || 'cliente').replace(/\s+/g, '_')}-${c.id.slice(0, 8)}.pdf`);
}
