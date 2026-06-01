import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, User, Phone, Building2, Mail, ArrowRight } from 'lucide-react';
import type { Affiliate } from '@/types/affiliates';

const FALLBACK_VSL = import.meta.env.VITE_VSL_URL || 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const FALLBACK_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '5588994463203';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'AF-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function extractWistiaId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/media-id=['"]([a-zA-Z0-9]+)['"]/) ||
    url.match(/wistia\.(?:com|net)\/embed\/(?:iframe|medias)\/([a-zA-Z0-9]+)/) ||
    url.match(/wistia\.com\/embed\/([a-zA-Z0-9]+)\.js/) ||
    url.match(/wistia\.com\/medias\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function cleanVideoUrl(url: string): string {
  if (!url) return `${FALLBACK_VSL}?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ`;
  const trimmed = url.trim();

  const ytId = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v)\/))([a-zA-Z0-9_-]{11})/);
  if (ytId && ytId[1]) {
    return `https://www.youtube.com/embed/${ytId[1]}?autoplay=1&mute=1&loop=1&playlist=${ytId[1]}`;
  }

  if (trimmed.includes('wistia.net/embed/iframe')) {
    return trimmed + (trimmed.includes('?') ? '&' : '?') + 'autoplay=1';
  }

  const srcAttr = trimmed.match(/src=['"]([^'"]+)['"]/);
  if (srcAttr && srcAttr[1] && !srcAttr[1].endsWith('.js')) {
    return srcAttr[1];
  }

  return trimmed;
}

function WistiaPlayer({ mediaId, onEnded }: { mediaId: string; onEnded?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ensureScript = (src: string, type?: string) => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      if (type) s.type = type;
      document.head.appendChild(s);
    };
    ensureScript('https://fast.wistia.com/player.js');
    const mediaScriptSrc = `https://fast.wistia.com/embed/${mediaId}.js`;
    document.querySelectorAll(`script[src="${mediaScriptSrc}"]`).forEach(s => s.remove());
    const mediaScript = document.createElement('script');
    mediaScript.src = mediaScriptSrc;
    mediaScript.async = true;
    mediaScript.type = 'module';
    document.head.appendChild(mediaScript);

    ref.current.innerHTML = '';
    const player = document.createElement('wistia-player') as any;
    player.setAttribute('media-id', mediaId);
    player.setAttribute('aspect', '0.5625');
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.display = 'block';
    ref.current.appendChild(player);

    const handler = () => onEnded?.();
    player.addEventListener('end', handler);
    player.addEventListener('ended', handler);

    return () => {
      player.removeEventListener('end', handler);
      player.removeEventListener('ended', handler);
    };
  }, [mediaId, onEnded]);

  return <div ref={ref} key={mediaId} className="w-full h-full absolute inset-0" />;
}

function HtmlEmbed({ html, onEnded }: { html: string; onEnded?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = html;

    // innerHTML não executa <script> — recriar cada <script> para rodar de verdade
    const scripts = Array.from(ref.current.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    // Se for Wistia, tenta bindar o evento de "ended" no player criado
    if (onEnded) {
      const tryBind = (attempt = 0) => {
        const player = ref.current?.querySelector('wistia-player') as any;
        if (player) {
          player.addEventListener?.('end', onEnded);
          player.addEventListener?.('ended', onEnded);
        } else if (attempt < 30) {
          setTimeout(() => tryBind(attempt + 1), 300);
        }
      };
      tryBind();
    }
  }, [html, onEnded]);

  return (
    <div
      ref={ref}
      className="w-full h-full absolute inset-0 [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!absolute [&_iframe]:!inset-0 [&_wistia-player]:!w-full [&_wistia-player]:!h-full [&_wistia-player]:!absolute [&_wistia-player]:!inset-0 [&_video]:!w-full [&_video]:!h-full [&_video]:!absolute [&_video]:!inset-0"
    />
  );
}

export default function AffiliateLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [leadToken, setLeadToken] = useState('');
  const [form, setForm] = useState({ lead_name: '', whatsapp: '', company: '', email: '' });
  const [settings, setSettings] = useState({ whatsappNumber: FALLBACK_WHATSAPP, vslVideoUrl: FALLBACK_VSL });
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('affiliates' as any)
          .select('*').eq('slug', slug).eq('status', 'aprovado').maybeSingle();
        setAffiliate(data as any);
      } catch (err) {
        console.error('[AffiliateLanding] Erro ao carregar afiliado:', err);
      }

      // Carrega configurações: Supabase table → localStorage → env → default
      try {
        const { data: cfg, error: cfgErr } = await supabase
          .from('affiliate_settings' as any)
          .select('whatsapp_number, vsl_video_url')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cfgErr) throw cfgErr;

        if (cfg) {
          const c = cfg as any;
          setSettings({
            whatsappNumber: c.whatsapp_number || FALLBACK_WHATSAPP,
            vslVideoUrl: c.vsl_video_url || FALLBACK_VSL,
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[AffiliateLanding] Sem acesso ao affiliate_settings:', err);
      }

      // Fallback: localStorage do visitante
      const saved = localStorage.getItem('affiliate_page_settings');
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setSettings({
            whatsappNumber: p.whatsappNumber || FALLBACK_WHATSAPP,
            vslVideoUrl: p.vslVideoUrl || FALLBACK_VSL,
          });
          setLoading(false);
          return;
        } catch {}
      }

      setLoading(false);
    })();
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!affiliate) return;
    setSending(true);
    try {
      let token = '';
      let attempts = 0;
      while (attempts < 10) {
        token = generateToken();
        const { data: existing } = await supabase
          .from('affiliate_leads' as any)
          .select('id')
          .ilike('notes', `%[TOKEN:${token}]%`)
          .maybeSingle();
        if (!existing) break;
        attempts++;
      }

      const notes = `[TOKEN:${token}]`;

      const { error } = await supabase.from('affiliate_leads' as any).insert({
        affiliate_id: affiliate.id,
        lead_name: form.lead_name.trim(),
        whatsapp: form.whatsapp.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        status: 'novo',
        notes,
      });
      if (error) throw error;

      setLeadToken(token);

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

  const vslRaw = (settings.vslVideoUrl || '').trim();
  const wistiaId = extractWistiaId(vslRaw);
  const isHtmlEmbed = /<\s*\w/.test(vslRaw);
  const handleVideoEnded = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRef.current?.classList.add('ring-2', 'ring-[#BFF720]', 'ring-offset-2', 'ring-offset-black');
    setTimeout(() => formRef.current?.classList.remove('ring-2', 'ring-[#BFF720]', 'ring-offset-2', 'ring-offset-black'), 2500);
  };

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 relative overflow-hidden flex flex-col items-center justify-center selection:bg-[#BFF720] selection:text-black">
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

        <div className="mb-8 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-zinc-900/40 relative" style={{ aspectRatio: '16 / 9' }}>
          {isHtmlEmbed ? (
            <HtmlEmbed html={vslRaw} onEnded={handleVideoEnded} />
          ) : wistiaId ? (
            <WistiaPlayer mediaId={wistiaId} onEnded={handleVideoEnded} />
          ) : (
            <iframe
              src={cleanVideoUrl(vslRaw)}
              className="w-full h-full absolute inset-0"
              allow="autoplay; fullscreen; picture-in-picture; accelerometer; clipboard-write; encrypted-media; gyroscope"
              allowFullScreen
            />
          )}
        </div>

        <Card ref={formRef} className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800/60 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 transition-all">
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
