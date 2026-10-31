import { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Loader2 as Spinner, Download, Share2 } from 'lucide-react';
import { DiagnosticReport } from '@/components/diagnostic/DiagnosticReport';
import { useSeo } from '@/lib/seo';
import { PAGE_THUMBS } from '@/lib/pageThumbs';

const DEMO_CONFIG = {
  cliente: { nome: '@sua_empresa' },
  intro: { texto: 'Análise completa da maturidade digital da sua empresa com recomendações estratégicas personalizadas para melhorar sua presença online e aumentar conversões.' },
  scores: { posicionamento: 72, autoridade: 65, presenca: 78, conversao: 55 },
  positivos: [
    'Presença consolidada nas principais redes sociais',
    'Marca possui identidade visual consistente',
    'Content marketing bem estruturado',
    'Engajamento médio acima do mercado'
  ],
  negativos: [
    'Bio não otimizada para conversão',
    'Falta call-to-action claro no perfil',
    'Links não direcionam para página específica',
    'Ausência de estratégia de automação'
  ],
  final: {
    destaque: 'Em Ascensão',
    texto: 'A empresa possui fundamentos sólidos, mas precisa otimizar a conversão do tráfego em resultados.',
    acao1: 'Otimizar bio com link para landing page',
    acao2: 'Criar sequência de automação no Direct',
    acao3: 'Implementar estratégia de remarketing',
    acao4: 'Desenvolver conteúdo para nutrir leads',
    acao5: 'Setup de Pixel para rastreamento'
  },
  semanas: [
    { label: 'Semana 1', titulo: 'Fundamentos', cards: [
      { tipo: 'Post', titulo: 'Reels Viral', gancho: 'Frase de impacto', estrutura: 'Hook + Valor + CTA', cta: 'Salvar' },
      { tipo: 'Story', titulo: 'Highlights', gancho: 'Categorização', estrutura: 'Capa + Ícones', cta: 'Ver mais' }
    ]},
    { label: 'Semana 2', titulo: 'Automação', cards: [
      { tipo: 'Automação', titulo: 'Sequência Welcome', gancho: 'Boas-vindas', estrutura: 'Mensagem inicial +follow-up', cta: 'Começar' },
      { tipo: 'Bot', titulo: 'Respostas', gancho: 'Perguntas frequentes', estrutura: 'Menu + opções', cta: 'Ativar' }
    ]},
    { label: 'Semana 3', titulo: 'Tráfego', cards: [
      { tipo: 'Ads', titulo: 'Campanha', gancho: 'Captura de leads', estrutura: 'Copy + creativo', cta: 'Launch' },
      { tipo: 'Orgânico', titulo: 'Viralização', gancho: 'Conteúdo shareable', estrutura: 'Trend + valor', cta: 'Postar' }
    ]},
    { label: 'Semana 4', titulo: 'Conversão', cards: [
      { tipo: 'Landing', titulo: 'Página', gancho: 'Oferta principal', estrutura: 'Hero + Prova + CTA', cta: 'Converter' },
      { tipo: 'Follow-up', titulo: 'Fechamento', gancho: 'Objection handling', estrutura: 'Pergunta + solução', cta: 'Fechar' }
    ]}
  ]
};

export default function DiagnosticLP() {
  useSeo({
    title: 'Diagnóstico de Marketing — INOVA Co.',
    description: 'Diagnóstico estratégico gratuito com os 4 pilares de marketing da INOVA Co.',
    image: PAGE_THUMBS.diagnostico,
    noindex: false,
  });
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [resolvedProfileImage, setResolvedProfileImage] = useState('');
  const [resolvedAnalysisImage, setResolvedAnalysisImage] = useState('');
  
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const fetchDiagnostic = async () => {
      try {
        if (slug) {
          // Visitante abre só pelo link: a função devolve um diagnóstico, sem dar para listar os outros
          const { data: raw, error } = await supabase.rpc('get_public_report' as never, { _kind: 'diagnostic', _slug: slug } as never);
          const data = raw as { config?: any } | null;
          
          if (error) {
            console.error('Erro da API:', error);
          }
          
          if (data?.config) {
            setConfig(data.config);
            setLoading(false);
            return;
          }
        }
        const saved = localStorage.getItem('agency_diagnostic_config_v4');
        if (saved) { 
          const parsed = JSON.parse(saved);
          setConfig(parsed);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Erro ao buscar diagnóstico:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiagnostic();
  }, [slug]);

  useEffect(() => {
    const resolveStorageUrl = async (url?: string | null) => {
      if (!url) return '';

      const storagePrefix = '/storage/v1/object/public/task-attachments/';
      if (!url.includes(storagePrefix)) return url;

      const filePath = decodeURIComponent(url.split(storagePrefix)[1] || '');
      if (!filePath) return url;

      const { data, error } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (error || !data?.signedUrl) {
        console.error('Erro ao gerar URL assinada da imagem do diagnóstico:', error);
        return url;
      }

      return data.signedUrl;
    };

    const resolveImages = async () => {
      const profileCandidate = config?.cliente?.foto || config?.aiAnalise?.analysisImageUrl || '';
      const analysisCandidate = config?.aiAnalise?.analysisImageUrl || '';

      const [profileUrl, analysisUrl] = await Promise.all([
        resolveStorageUrl(profileCandidate),
        resolveStorageUrl(analysisCandidate),
      ]);

      setResolvedProfileImage(profileUrl);
      setResolvedAnalysisImage(analysisUrl);
    };

    void resolveImages();
  }, [config]);

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a63de]">
      <Spinner className="h-8 w-8 animate-spin text-[#bff720]" />
    </div>
  );

  const displayConfig = config || DEMO_CONFIG;


  const clienteNome = displayConfig?.cliente?.nome || '@empresa';
  const fotoPerfil = resolvedProfileImage || displayConfig?.cliente?.foto || displayConfig?.aiAnalise?.analysisImageUrl || '';

  return (
    <div className="diagnostic-lp-root min-h-screen overflow-x-hidden bg-[#0a63de] scroll-smooth">

      {/* FLOATING ACTION BUTTONS (hidden in print) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 no-print">
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `Diagnóstico - ${clienteNome}`, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copiado!');
            }
          }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 backdrop-blur-md text-black shadow-xl border border-gray-200 flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Compartilhar"
        >
          <Share2 size={18} />
        </motion.button>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.print()}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#bff720] text-black shadow-xl shadow-[#bff720]/30 flex items-center justify-center hover:bg-[#d4ff4a] transition-colors"
          aria-label="Baixar PDF"
        >
          <Download size={18} />
        </motion.button>
      </div>

      {/* PROGRESS BAR */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#bff720] z-50 origin-left no-print"
        style={{ scaleX }}
      />

      <DiagnosticReport config={displayConfig} profileImage={fotoPerfil} analysisImage={resolvedAnalysisImage} />

      {/* PRINT / PDF STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Force 16:9 Presentation Format */
          @page {
            size: 1920px 1080px; /* 16:9 aspect ratio */
            margin: 0;
          }

          /* Hide non-content elements */
          .no-print,
          .fixed,
          nav, [data-sidebar], [role="navigation"],
          .sonner-toaster { display: none !important; }

          /* Root reset */
          html, body {
            margin: 0 !important; padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 1920px !important;
            height: auto !important;
          }

          /* Remove height and overflow constraints */
          .diagnostic-lp-root {
            width: 1920px !important;
            max-width: 1920px !important;
            height: auto !important;
            overflow: hidden !important;
            display: block !important;
            zoom: 1 !important; /* Reset zoom as we're explicitly sizing */
          }

          /* Make sections behave exactly like 16:9 slides */
          .diagnostic-lp-root section {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            width: 1920px !important;
            height: 1080px !important;
            min-height: 1080px !important;
            max-height: 1080px !important;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            padding: 80px 120px !important; /* Beautiful large padding for 16:9 */
            box-sizing: border-box !important;
            position: relative !important;
            overflow: hidden !important;
          }

          /* Adjust footer to be a slide as well */
          .diagnostic-lp-root footer {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            width: 1920px !important;
            height: 1080px !important;
            padding: 80px 120px !important;
            box-sizing: border-box !important;
            page-break-after: auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Ensure grids are correctly spaced for the large 1920x1080 layout */
          .diagnostic-lp-root .max-w-7xl,
          .diagnostic-lp-root .max-w-6xl,
          .diagnostic-lp-root .max-w-5xl {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
          }

          .diagnostic-lp-root .grid {
            display: grid !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          .diagnostic-lp-root .lg\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 80px !important; /* Larger gap for 16:9 */
          }
          .diagnostic-lp-root .lg\\:grid-cols-12 {
            grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
            gap: 60px !important;
          }
          .diagnostic-lp-root .lg\\:col-span-6 {
            grid-column: span 6 / span 6 !important;
          }
          .diagnostic-lp-root .lg\\:col-span-12 {
            grid-column: span 12 / span 12 !important;
          }

          .diagnostic-lp-root [class*="rounded-"] {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Force framer-motion visibility */
          .diagnostic-lp-root * {
            animation: none !important;
            transition: none !important;
          }

          .diagnostic-lp-root div[style*="opacity"],
          .diagnostic-lp-root h2[style*="opacity"],
          .diagnostic-lp-root h3[style*="opacity"],
          .diagnostic-lp-root h4[style*="opacity"],
          .diagnostic-lp-root p[style*="opacity"],
          .diagnostic-lp-root span[style*="opacity"],
          .diagnostic-lp-root img[style*="opacity"] {
             opacity: 1 !important;
             transform: none !important;
          }

          /* Re-apply decorative opacities */
          .diagnostic-lp-root .opacity-0 { opacity: 0 !important; }
          .diagnostic-lp-root .opacity-5 { opacity: 0.05 !important; }
          .diagnostic-lp-root .opacity-10 { opacity: 0.1 !important; }
          .diagnostic-lp-root .opacity-[0.02] { opacity: 0.02 !important; }
          .diagnostic-lp-root .opacity-[0.08] { opacity: 0.08 !important; }
          .diagnostic-lp-root .opacity-20 { opacity: 0.2 !important; }
          .diagnostic-lp-root .opacity-30 { opacity: 0.3 !important; }
          .diagnostic-lp-root .opacity-40 { opacity: 0.4 !important; }
          .diagnostic-lp-root .opacity-50 { opacity: 0.5 !important; }

          .diagnostic-lp-root [class*="blur-"] {
            filter: none !important;
            opacity: 0 !important;
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
