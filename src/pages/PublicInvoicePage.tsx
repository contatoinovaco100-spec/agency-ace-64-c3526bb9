import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, CheckCircle2, Send, Loader2, Link2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type Invoice = {
  id: string;
  client_name: string;
  client_contact: string;
  description: string;
  amount: number;
  due_date: string | null;
  status: 'pendente' | 'pago';
  custom_message: string;
  pix_code: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PublicInvoicePage() {
  const { id } = useParams();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (supabase as any)
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }: any) => {
        setInv(data as Invoice | null);
        setLoading(false);
      });
  }, [id]);

  const copy = async () => {
    if (!inv) return;
    await navigator.clipboard.writeText(inv.pix_code);
    toast.success('Código Pix copiado!');
  };

  const shareWa = () => {
    if (!inv) return;
    const msg = encodeURIComponent(
      `Olá! Segue sua fatura:\n\n💰 Valor: ${formatBRL(Number(inv.amount))}\n` +
      (inv.due_date ? `📅 Vencimento: ${new Date(inv.due_date + 'T00:00').toLocaleDateString('pt-BR')}\n` : '') +
      `\nAcesse para pagar via Pix:\n${window.location.href}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link da fatura copiado!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold mb-2">Fatura não encontrada</h1>
            <p className="text-muted-foreground text-sm">Verifique o link e tente novamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Fatura</h1>
              {inv.status === 'pago' ? (
                <Badge className="bg-primary/15 text-primary border-primary/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Pendente</Badge>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground tracking-wider">Para</div>
              <div className="font-medium">{inv.client_name}</div>
            </div>

            {inv.description && (
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Descrição</div>
                <div className="text-sm whitespace-pre-wrap">{inv.description}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Valor</div>
                <div className="text-2xl font-bold text-primary">{formatBRL(Number(inv.amount))}</div>
              </div>
              {inv.due_date && (
                <div className="text-right">
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">Vencimento</div>
                  <div className="text-base font-medium">
                    {new Date(inv.due_date + 'T00:00').toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
            </div>

            {inv.custom_message && (
              <div className="p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">
                {inv.custom_message}
              </div>
            )}
          </CardContent>
        </Card>

        {inv.status !== 'pago' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <h2 className="font-semibold mb-1">Pagar com Pix</h2>
                <p className="text-xs text-muted-foreground">Escaneie o QR Code com o app do seu banco</p>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={inv.pix_code} size={240} level="M" includeMargin />
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Pix copia e cola</div>
                <div className="text-[11px] font-mono break-all p-3 rounded-md bg-muted/50 max-h-24 overflow-y-auto">
                  {inv.pix_code}
                </div>
              </div>

              <Button className="w-full" onClick={copy} size="lg">
                <Copy className="h-4 w-4 mr-2" /> Copiar código Pix
              </Button>
              <Button variant="outline" className="w-full" onClick={shareWa}>
                <Send className="h-4 w-4 mr-2" /> Compartilhar via WhatsApp
              </Button>
              <Button variant="secondary" className="w-full" onClick={copyLink}>
                <Link2 className="h-4 w-4 mr-2" /> Copiar Link da Fatura
              </Button>
            </CardContent>
          </Card>
        )}

        {inv.status === 'pago' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="font-medium">Pagamento confirmado</p>
              <p className="text-sm text-muted-foreground">Obrigado!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
