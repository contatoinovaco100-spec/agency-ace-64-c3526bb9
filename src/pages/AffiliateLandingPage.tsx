import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, User, Phone, Building2, Mail, ArrowRight } from 'lucide-react';
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin text-[#BFF720] w-8 h-8" /></div>;

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800"><CardContent className="pt-8 text-center"><p className="text-zinc-400">Link inválido ou consultor não encontrado.</p></CardContent></Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#BFF720]/10 rounded-full blur-[120px]" />
        
        <Card className="max-w-md w-full bg-zinc-900/70 backdrop-blur-xl border-zinc-800/50 relative z-10 animate-in fade-in zoom-in duration-500">
          <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
            <div className="w-20 h-20 bg-[#BFF720]/10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-[0_0_30px_rgba(191,247,32,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-[#BFF720]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Contato Recebido!</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">Nossa equipe de especialistas entrará em contato com você em breve pelo WhatsApp para agendar uma conversa.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 relative overflow-hidden flex flex-col items-center justify-center selection:bg-[#BFF720] selection:text-black">
      {/* Background Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[500px] bg-[#BFF720]/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-md w-full mx-auto relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-8 duration-700">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Inova <span className="text-[#BFF720]">Marketing</span>
          </h1>
          <p className="text-zinc-400 text-md px-4">
            Você foi indicado(a) por <strong className="text-white">{affiliate.full_name}</strong>. Preencha seus dados abaixo para nossa equipe entrar em contato.
          </p>
        </div>

        <Card className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800/60 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="pb-6 border-b border-zinc-800/60">
            <CardTitle className="text-xl font-bold text-center">Fale com um Especialista</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-zinc-300">Seu Nome *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input required value={form.lead_name} onChange={e => setForm({ ...form, lead_name: e.target.value })} className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] focus:ring-[#BFF720]/20 transition-colors h-11" placeholder="Como devemos te chamar?" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">WhatsApp *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input required value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] focus:ring-[#BFF720]/20 transition-colors h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Nome da Empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] focus:ring-[#BFF720]/20 transition-colors h-11" placeholder="Qual a sua empresa?" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">E-mail corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] focus:ring-[#BFF720]/20 transition-colors h-11" placeholder="seu@email.com" />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={sending} className="w-full bg-[#BFF720] text-black hover:bg-[#a8de15] hover:shadow-[0_0_20px_rgba(191,247,32,0.3)] transition-all h-12 text-md font-bold flex items-center justify-center gap-2">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Solicitar Contato <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
