import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Check, Lock, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PublicReferralFormPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await (supabase as any).rpc('get_public_referral_client_by_token', { _token: token });
      const publicClient = Array.isArray(data) ? data[0] : data;
      if (!publicClient) setNotFound(true);
      else { setClientId(publicClient.id); setClientName(publicClient.name); }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const trimmedName = name.trim();
    const trimmedWa = whatsapp.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      toast({ title: 'Nome inválido', description: 'Informe um nome válido.', variant: 'destructive' });
      return;
    }
    if (trimmedWa.length < 8 || trimmedWa.length > 30) {
      toast({ title: 'WhatsApp inválido', description: 'Informe um número válido.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc('submit_public_referral', {
      _token: token,
      _referred_name: trimmedName,
      _referred_whatsapp: trimmedWa,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      return;
    }
    setSuccess(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-md mx-auto space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-10 text-center max-w-md">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold mb-2">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de indicação não foi encontrado.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
          <Sparkles className="h-4 w-4" /> INOVA · Indicação
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Obrigado!</h1>
            <p className="text-sm text-muted-foreground">
              Sua indicação foi enviada com sucesso. Nossa equipe vai entrar em contato em breve.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Você foi indicado por <span className="text-primary">{clientName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Preencha seus dados para que a INOVA entre em contato com você.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome completo"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(11) 90000-0000"
                  maxLength={30}
                  required
                />
              </div>
              <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                <Send className="h-4 w-4" /> {submitting ? 'Enviando…' : 'Enviar indicação'}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
