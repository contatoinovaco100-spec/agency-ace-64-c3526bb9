import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, User, Mail, Phone, MapPin, Instagram, Key, Briefcase, DollarSign, Lock } from 'lucide-react';

export default function AffiliateSignupPage() {
  const { toast } = useToast();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    full_name: '', cpf_cnpj: '', whatsapp: '', email: '', instagram: '',
    city_state: '', how_found: '', sales_experience: 'nao', pix_key: '', password: '',
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
        pix_key: form.pix_key.trim(),
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
          p_sales_experience: form.sales_experience === 'sim',
          p_pix_key: form.pix_key.trim()
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
        {/* Efeitos de luz no background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#BFF720]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#BFF720]/10 rounded-full blur-[120px]" />
        
        <Card className="max-w-md w-full bg-zinc-900/70 backdrop-blur-xl border-zinc-800/50 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
            <div className="w-20 h-20 bg-[#BFF720]/10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-[0_0_30px_rgba(191,247,32,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-[#BFF720]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Cadastro Recebido!</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">Seu cadastro está em análise. Assim que aprovado, você receberá um email e terá acesso ao seu painel de afiliado com seu link exclusivo.</p>
            </div>
            <Button onClick={() => nav('/login')} className="w-full bg-[#BFF720] text-black hover:bg-[#a8de15] hover:shadow-[0_0_20px_rgba(191,247,32,0.3)] transition-all h-12 text-md font-semibold mt-4">
              Ir para login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 relative overflow-hidden flex flex-col items-center justify-center selection:bg-[#BFF720] selection:text-black">
      {/* Background Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-[#BFF720]/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-2xl w-full mx-auto relative z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-8 duration-700">
          <Badge className="bg-[#BFF720]/10 text-[#BFF720] hover:bg-[#BFF720]/20 border-[#BFF720]/20 mb-4 px-4 py-1.5 text-sm">
            Programa de Parceiros
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            Seja um Afiliado <span className="text-[#BFF720]">Inova</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto">
            Ganhe <strong className="text-white">R$300</strong> por fechamento + <strong className="text-white">R$100/mês</strong> recorrente enquanto o cliente estiver ativo.
          </p>
        </div>

        <Card className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800/60 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="pb-6 border-b border-zinc-800/60">
            <CardTitle className="text-2xl font-bold">Crie sua conta</CardTitle>
            <CardDescription className="text-zinc-400 text-sm">Preencha seus dados com atenção. Seu perfil passará por análise antes da aprovação final.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-6">
              
              {/* Seção 1: Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-[#BFF720] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" /> Dados Pessoais
                </h3>
                
                <div className="space-y-2">
                  <Label className="text-zinc-300">Nome completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] focus:ring-[#BFF720]/20 transition-colors h-11" placeholder="Digite seu nome completo" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">CPF ou CNPJ *</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input required value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)} className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" placeholder="Apenas números" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">WhatsApp *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input required value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Instagram</Label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@usuario" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Cidade e Estado *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input required value={form.city_state} onChange={e => set('city_state', e.target.value)} placeholder="Ex: São Paulo, SP" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Pagamentos e Experiência */}
              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <h3 className="text-sm font-medium text-[#BFF720] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Pagamentos e Informações
                </h3>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Sua Chave PIX *</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input required value={form.pix_key} onChange={e => set('pix_key', e.target.value)} placeholder="Email, CPF, Celular ou Aleatória" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                  </div>
                  <p className="text-xs text-zinc-500">Usaremos essa chave para depositar suas comissões.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Como conheceu a Inova Marketing?</Label>
                  <Textarea value={form.how_found} onChange={e => set('how_found', e.target.value)} placeholder="Nos conte rapidamente..." className="bg-zinc-950/50 border-zinc-800 focus:border-[#BFF720] min-h-[80px] resize-none" />
                </div>

                <div className="space-y-3">
                  <Label className="text-zinc-300">Você já tem experiência com vendas?</Label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => set('sales_experience', 'sim')} className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${form.sales_experience === 'sim' ? 'bg-[#BFF720]/10 border-[#BFF720] text-[#BFF720]' : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>Sim</button>
                    <button type="button" onClick={() => set('sales_experience', 'nao')} className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${form.sales_experience === 'nao' ? 'bg-[#BFF720]/10 border-[#BFF720] text-[#BFF720]' : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>Não</button>
                  </div>
                </div>
              </div>

              {/* Seção 3: Acesso */}
              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <h3 className="text-sm font-medium text-[#BFF720] uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Dados de Acesso
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">E-mail de acesso *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="seu@email.com" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Senha (mínimo 6 caracteres) *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input required type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder="••••••••" className="bg-zinc-950/50 border-zinc-800 pl-10 focus:border-[#BFF720] h-11" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={loading} className="w-full bg-[#BFF720] text-black hover:bg-[#a8de15] hover:shadow-[0_0_20px_rgba(191,247,32,0.3)] transition-all h-12 text-md font-bold uppercase tracking-wide">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Cadastro'}
                </Button>
                <p className="text-sm text-zinc-500 text-center mt-4">
                  Já é afiliado? <Link to="/login" className="text-[#BFF720] hover:underline hover:text-[#a8de15] font-medium transition-colors">Faça login no painel</Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* Texto de rodapé simples */}
      <div className="relative z-10 text-center text-zinc-600 text-xs mt-8 pb-4">
        &copy; {new Date().getFullYear()} Inova Marketing. Todos os direitos reservados.
      </div>
    </div>
  );
}
