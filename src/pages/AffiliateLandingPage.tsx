import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { Affiliate } from '@/types/affiliates';

export default function AffiliateLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ lead_name: '', whatsapp: '', company: '', email: '' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('affiliates' as any)
        .select('*').eq('slug', slug).eq('status', 'aprovado').maybeSingle();
      setAffiliate(data as any);
      setLoading(false);
    })();
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!affiliate) return;
    setSending(true);
    try {
      const { error } = await supabase.from('affiliate_leads' as any).insert({
        affiliate_id: affiliate.id,
        lead_name: form.lead_name.trim(),
        whatsapp: form.whatsapp.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        status: 'novo',
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally { setSending(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin" /></div>;

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full"><CardContent className="pt-8 text-center"><p>Link inválido ou afiliado não encontrado.</p></CardContent></Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold">Recebido!</h2>
            <p className="text-zinc-600">Em breve a equipe da Innova entrará em contato.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">Innova Marketing</h1>
          <p className="text-zinc-600 mt-2">Você foi indicado por <strong>{affiliate.full_name}</strong>. Preencha seus dados para receber um contato.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Quero conhecer</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div><Label>Nome *</Label><Input required value={form.lead_name} onChange={e => setForm({ ...form, lead_name: e.target.value })} /></div>
              <div><Label>WhatsApp *</Label><Input required value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></div>
              <div><Label>Empresa</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <Button type="submit" disabled={sending} className="w-full">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
