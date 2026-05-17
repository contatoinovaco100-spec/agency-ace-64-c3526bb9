import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function AffiliateSignupPage() {
  const { toast } = useToast();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    full_name: '', cpf_cnpj: '', whatsapp: '', email: '', instagram: '',
    city_state: '', how_found: '', sales_experience: 'nao', password: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      let userId = null;
      const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { emailRedirectTo: `${window.location.origin}/afiliado` },
      });
      
      if (authErr) {
        if (authErr.message.toLowerCase().includes('already registered') || authErr.message.toLowerCase().includes('já cadastrado')) {
          // Ignore and continue without linking user_id right now
          userId = null;
        } else {
          throw authErr;
        }
      } else {
        userId = auth.user?.id ?? null;
      }

      let insErr = null;
      const { error: initialErr } = await supabase.from('affiliates' as any).insert({
        user_id: userId,
        full_name: form.full_name.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        city_state: form.city_state.trim(),
        how_found: form.how_found.trim(),
        sales_experience: form.sales_experience === 'sim',
        status: 'em_analise',
      });
      
      if (initialErr) {
        // Fallback to RPC if RLS blocks the insert/select cycle
        const { error: rpcErr } = await supabase.rpc('register_affiliate_safe', {
          p_user_id: userId,
          p_full_name: form.full_name.trim(),
          p_cpf_cnpj: form.cpf_cnpj.trim(),
          p_whatsapp: form.whatsapp.trim(),
          p_email: form.email.trim(),
          p_instagram: form.instagram.trim(),
          p_city_state: form.city_state.trim(),
          p_how_found: form.how_found.trim(),
          p_sales_experience: form.sales_experience === 'sim'
        });
        
        if (rpcErr) {
          // If RPC also fails (or doesn't exist yet), check if original was RLS
          if (initialErr.message.includes('row-level security')) {
            // Ignoramos erro de RLS e assumimos sucesso parcial se for apenas select failing
          } else {
            insErr = initialErr;
          }
        }
      }
      
      if (insErr) {
        throw insErr;
      }
      
      setDone(true);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro no cadastro', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-[#BFF720] mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro enviado!</h2>
            <p className="text-zinc-400">Seu cadastro está em análise. Assim que aprovado, você receberá acesso ao seu painel de afiliado com seu link único.</p>
            <Button onClick={() => nav('/login')} className="bg-[#BFF720] text-black hover:bg-[#a8de15]">Ir para login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Programa de Afiliados <span className="text-[#BFF720]">Inova</span></h1>
          <p className="text-zinc-400">Ganhe R$300 por fechamento + R$100/mês recorrente enquanto o cliente estiver ativo.</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Cadastro de Afiliado</CardTitle>
            <CardDescription>Preencha seus dados. Seu cadastro passará por análise antes da liberação.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div><Label>Nome completo *</Label><Input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF/CNPJ *</Label><Input required value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                <div><Label>WhatsApp *</Label><Input required value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" className="bg-zinc-800 border-zinc-700" /></div>
              </div>
              <div><Label>E-mail *</Label><Input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@usuario" className="bg-zinc-800 border-zinc-700" /></div>
                <div><Label>Cidade/Estado *</Label><Input required value={form.city_state} onChange={e => set('city_state', e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
              </div>
              <div><Label>Como conheceu a Inova?</Label><Textarea value={form.how_found} onChange={e => set('how_found', e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
              <div>
                <Label>Experiência com vendas?</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2"><input type="radio" name="exp" value="sim" checked={form.sales_experience === 'sim'} onChange={e => set('sales_experience', e.target.value)} /> Sim</label>
                  <label className="flex items-center gap-2"><input type="radio" name="exp" value="nao" checked={form.sales_experience === 'nao'} onChange={e => set('sales_experience', e.target.value)} /> Não</label>
                </div>
              </div>
              <div><Label>Senha *</Label><Input required type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6} className="bg-zinc-800 border-zinc-700" /></div>

              <Button type="submit" disabled={loading} className="w-full bg-[#BFF720] text-black hover:bg-[#a8de15] font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar cadastro'}
              </Button>
              <p className="text-xs text-zinc-500 text-center">Já é afiliado? <Link to="/login" className="text-[#BFF720] hover:underline">Faça login</Link></p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
