import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, User, Phone, Building2, Mail, ArrowRight, Video } from 'lucide-react';
import type { Affiliate } from '@/types/affiliates';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'AF-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Valores padrão de fallback
const DEFAULT_WHATSAPP = '5588994463203';
const DEFAULT_VSL = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

// Função inteligente para extrair URL limpa de iframes a partir de códigos HTML colados (Wistia, YouTube, Vimeo, etc)
function cleanVideoUrl(url: string): string {
  if (!url) return DEFAULT_VSL;

  // 1. Se colou o código HTML completo do Wistia (com <script>, <wistia-player>, media-id, etc)
  const wistiaMatch = url.match(/media-id=['"]([^'"]+)['"]/) || url.match(/embed\/([a-zA-Z0-9]+)\.js/);
  if (wistiaMatch && wistiaMatch[1]) {
    return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}?autoplay=1`;
  }

  // 2. Se colou link direto do Wistia iframe
  if (url.includes('wistia.net/embed/iframe')) {
    return url;
  }

  // 3. Se colou link do YouTube watch?v=
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v)\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // 4. Se for um iframe ou script genérico, tenta extrair o atributo src
  const srcMatch = url.match(/src=['"]([^'"]+)['"]/);
  if (srcMatch && srcMatch[1] && !srcMatch[1].endsWith('.js')) {
    return srcMatch[1];
  }

  return url;
}

export default function AffiliateLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ lead_name: '', whatsapp: '', company: '', email: '' });
  const [settings, setSettings] = useState({ whatsappNumber: DEFAULT_WHATSAPP, vslVideoUrl: DEFAULT_VSL });

  useEffect(() => {
    (async () => {
      // 1. Carrega dados do afiliado
      const { data } = await supabase.from('affiliates' as any)
        .select('*').eq('slug', slug).eq('status', 'aprovado').maybeSingle();
      setAffiliate(data as any);

      // 2. Carrega configurações da página (Supabase affiliate_settings com fallback para localStorage)
      let loadedSettings = { whatsappNumber: DEFAULT_WHATSAPP, vslVideoUrl: DEFAULT_VSL };
      try {
        const { data: cfg } = await supabase.from('affiliate_settings' as any).select('*').limit(1).maybeSingle();
        if (cfg) {
          const c = cfg as any;
          loadedSettings = {
            whatsappNumber: c.whatsapp_number || DEFAULT_WHATSAPP,
            vslVideoUrl: c.vsl_video_url || DEFAULT_VSL
          };
        } else {
          const saved = localStorage.getItem('affiliate_page_settings');
          if (saved) { try { loadedSettings = JSON.parse(saved); } catch {} }
        }
      } catch (err) {
        const saved = localStorage.getItem('affiliate_page_settings');
        if (saved) { try { loadedSettings = JSON.parse(saved); } catch {} }
      }
      setSettings(loadedSettings);
      setLoading(false);
    })();
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!affiliate) return;
    setSending(true);
    try {
      // Gera token único (garante unicidade com retry)
      let token = '';
      let attempts = 0;
      while (attempts < 5) {
        token = generateToken();
        const { data: existing } = await supabase.from('affiliate_leads' as any)
          .select('id').eq('token', token).maybeSingle();
        if (!existing) break;
        attempts++;
      }

      const { error } = await supabase.from('affiliate_leads' as any).insert({
        affiliate_id: affiliate.id,
        token,
        lead_name: form.lead_name.trim(),
        whatsapp: form.whatsapp.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        status: 'novo',
      });
      if (error) throw error;
      
      // Mensagem personalizada para o WhatsApp
      const msg = `Olá! Fui indicado(a) por ${affiliate.full_name} através da página exclusiva e acabei de preencher o formulário. Gostaria de falar com um especialista sobre as soluções da Inova!`;
      const waUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      
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
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">Nossa equipe de especialistas entrará em contato com você em breve pelo WhatsApp para agendar uma conversa.</p>
              
              
              <Button 
                onClick={() => {
                  const msg = `Olá! Fui indicado(a) por ${affiliate.full_name} através da página exclusiva e acabei de preencher o formulário. Gostaria de falar com um especialista sobre as soluções da Inova!`;
                  window.open(`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
                }} 
                className="w-full bg-[#BFF720] text-black hover:bg-[#a8de15] hover:shadow-[0_0_20px_rgba(191,247,32,0.3)] transition-all font-bold h-12 text-md flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" /> Abrir WhatsApp da Inova Agora
              </Button>
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

        {/* ================= VSL VIDEO NO TOPO ================= */}
        <div className="mb-8 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-zinc-900/40 aspect-video relative animate-in fade-in zoom-in duration-700">
          <iframe 
            src={cleanVideoUrl(settings.vslVideoUrl)}
            className="w-full h-full absolute inset-0"
            allow="autoplay; fullscreen; picture-in-picture; accelerometer; clipboard-write; encrypted-media; gyroscope" 
            allowFullScreen
          />
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
