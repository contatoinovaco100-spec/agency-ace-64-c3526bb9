import { useId } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight, Plus, Trash2, Sparkles } from 'lucide-react';
import '@fontsource/sora/800.css';
import LogoInova from '@/assets/logo-inova.png';

/*
 * Relatório público do diagnóstico (/diagnostico/:slug) e prévia do editor.
 * Página pública de marca: paleta própria em hex (exceção à regra de tokens).
 * Layout responde à largura do contêiner (variantes cq-*), não da janela,
 * para que a moldura de celular do editor mostre o layout real de celular.
 */
const C = {
  blue: '#0a63de',
  blueLight: '#2f8bff',
  blueDeep: '#0849b0',
  lime: '#bff720',
  ink: '#0b0d10',
  paper: '#f1f3f6',
};

const DISPLAY = { fontFamily: 'Sora, Manrope, system-ui, sans-serif', fontWeight: 800 } as const;

/* ═══════ RABISCOS À MÃO ═══════ */
const LoopArrow = ({ className, color = C.lime }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 160 120" fill="none" className={className} aria-hidden>
    <path d="M12 98 C40 98 62 72 48 52 C34 32 6 56 28 72 C52 90 98 74 130 30" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M104 28 L132 26 L126 54" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CurveArrow = ({ className, color = C.lime }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 160 160" fill="none" className={className} aria-hidden>
    <path d="M34 22 C118 6 156 70 108 126" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M82 108 L106 130 L128 100" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Scribble = ({ className, color = C.ink, width = 7 }: { className?: string; color?: string; width?: number }) => (
  <svg viewBox="0 0 100 80" fill="none" className={className} aria-hidden>
    <path d="M14 32 C20 6 58 8 50 32 C44 52 14 70 22 72 C40 76 62 40 88 46" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Underline = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 300 24" fill="none" preserveAspectRatio="none" className={className} aria-hidden>
    <path d="M6 16 C60 4 110 22 160 12 C210 2 250 18 294 8" stroke={C.lime} strokeWidth="8" strokeLinecap="round" />
  </svg>
);

/** Selo circular girando com texto, como o "get started for free" da referência. */
const Seal = ({ text, className }: { text: string; className?: string }) => {
  const pathId = `dlp-seal-${useId().replace(/:/g, '')}`;
  return (
  <div className={`aspect-square ${className ?? 'relative'}`}>
    <svg viewBox="0 0 200 200" className="dlp-spin absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <path id={pathId} d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
      </defs>
      <circle cx="100" cy="100" r="100" fill={C.lime} />
      <text fill={C.ink} style={{ ...DISPLAY, fontSize: 17, letterSpacing: 2.5, textTransform: 'uppercase' }}>
        <textPath href={`#${pathId}`}>{text}</textPath>
      </text>
    </svg>
    <Scribble className="absolute left-1/2 top-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2" />
  </div>
  );
};

/* ═══════ EDIÇÃO EM LINHA (só no editor) ═══════ */
const inheritFont = { font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit' } as const;

const Editable = ({ value, onChange, editing, multiline = false }: {
  value: string; onChange?: (v: string) => void; editing: boolean; multiline?: boolean;
}) => {
  if (!editing || !onChange) return <>{value}</>;
  const cls = 'w-full rounded-lg border-2 border-dashed border-[#bff720] bg-white/10 px-2 py-1 outline-none focus:border-solid';
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} className={`${cls} min-h-[96px]`} style={inheritFont} />
    : <input value={value} onChange={e => onChange(e.target.value)} className={cls} style={inheritFont} />;
};

const RemoveButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#e5484d] text-white shadow-lg transition-transform active:scale-[0.97]">
    <Trash2 size={14} />
  </button>
);

const AddButton = ({ onClick, children, dark = false }: { onClick: () => void; children: React.ReactNode; dark?: boolean }) => (
  <button type="button" onClick={onClick}
    className={`flex w-full items-center justify-center gap-2 rounded-[24px] border-2 border-dashed px-4 py-5 text-sm font-bold uppercase tracking-wide transition-colors ${dark ? 'border-white/30 text-white hover:bg-white/10' : 'border-[#0a63de]/30 text-[#0a63de] hover:bg-[#0a63de]/5'}`}>
    <Plus size={18} /> {children}
  </button>
);

const Eyebrow = ({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'lime' | 'outline' }) => {
  const styles = {
    blue: 'bg-[#0a63de] text-white',
    lime: 'bg-[#bff720] text-[#0b0d10]',
    outline: 'border border-white/60 text-white',
  }[tone];
  return <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${styles}`}>{children}</span>;
};

/* ═══════ RELATÓRIO ═══════ */
interface DiagnosticReportProps {
  config: any;
  profileImage?: string;
  analysisImage?: string;
  /** No editor: liga os campos editáveis e os botões de adicionar/remover. */
  editing?: boolean;
  onChange?: (next: any) => void;
}

export function DiagnosticReport({ config, profileImage, analysisImage, editing = false, onChange }: DiagnosticReportProps) {
  const canEdit = editing && !!onChange;
  const mutate = (fn: (draft: any) => void) => {
    if (!onChange) return;
    const next = structuredClone(config);
    fn(next);
    onChange(next);
  };

  const cliente = config?.cliente || {};
  const handle = String(cliente.nome || '@empresa').replace('@', '');
  const foto = profileImage || cliente.foto || config?.aiAnalise?.analysisImageUrl || '';
  const scores = config?.scores || { posicionamento: 0, autoridade: 0, presenca: 0, conversao: 0 };
  const media = Math.round(((scores.posicionamento || 0) + (scores.autoridade || 0) + (scores.presenca || 0) + (scores.conversao || 0)) / 4);
  const positivos: string[] = config?.positivos || [];
  const negativos: string[] = config?.negativos || [];
  const semanas: any[] = config?.semanas || [];
  const final = config?.final || {};
  const ai = config?.aiAnalise;
  const printImage = analysisImage || ai?.analysisImageUrl;
  const introTexto = config?.intro?.texto || 'Análise completa da sua presença digital e recomendações estratégicas para melhorar seu posicionamento online.';

  const pilares = [
    { key: 'posicionamento', label: 'Posicionamento', hint: 'clareza de quem você é e para quem fala' },
    { key: 'autoridade', label: 'Autoridade', hint: 'provas e confiança que o perfil transmite' },
    { key: 'presenca', label: 'Presença digital', hint: 'constância e qualidade do que aparece' },
    { key: 'conversao', label: 'Conversão', hint: 'caminho do seguidor até a venda' },
  ];

  // CTA final: WhatsApp da agência quando for um número real, senão o Instagram
  const whatsDigits = String(cliente.whatsAgencia || '').replace(/\D/g, '');
  const insta = String(cliente.instaAgencia || '').replace('@', '').trim();
  const ctaHref = whatsDigits.length >= 10 && !/9{5}/.test(whatsDigits)
    ? `https://wa.me/${whatsDigits.startsWith('55') ? whatsDigits : `55${whatsDigits}`}?text=${encodeURIComponent('Olá! Vi meu diagnóstico e quero ajuda para colocar o plano em prática.')}`
    : insta ? `https://instagram.com/${insta}` : null;

  const Avatar = ({ size }: { size: string }) => (
    <div className={`${size} shrink-0 overflow-hidden rounded-full border-[3px] border-[#bff720] bg-[#0849b0]`}>
      {foto ? (
        <img src={foto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg text-white" style={DISPLAY}>{handle.charAt(0).toUpperCase()}</div>
      )}
    </div>
  );

  return (
    <div className="diagnostic-report bg-[#0a63de] text-left text-[#0b0d10] selection:bg-[#bff720] selection:text-black"
      style={{ containerType: 'inline-size', fontFamily: 'Manrope, system-ui, sans-serif' }}>

      {/* ── CAPA ── */}
      <section className="dlp-hero relative overflow-hidden px-4 pb-24 pt-5 text-white cq-sm:px-8 cq-sm:pb-32">
        <div className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(ellipse at center, #000 45%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, #000 45%, transparent 85%)',
          }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 0%, ${C.blueLight}66, transparent 70%)` }} />

        {/* Topo */}
        <nav className="relative z-10 flex items-center justify-between gap-3">
          <img src={LogoInova} alt="INOVA Co." className="h-6 brightness-0 invert cq-sm:h-7" />
          <div className="hidden items-center gap-1.5 cq-md:flex">
            {[['#panorama', 'Panorama'], ['#insights', 'Insights'], ['#veredito', 'Plano de ação'], ['#cronograma', 'Cronograma']].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-white hover:text-[#0a63de]">{label}</a>
            ))}
          </div>
          <span className="max-w-[55%] truncate rounded-full border-2 border-white px-4 py-2 text-xs font-bold cq-sm:px-6 cq-sm:text-sm">@{handle}</span>
        </nav>

        {/* Título gigante */}
        <div className="relative z-0 mx-auto mt-14 max-w-[1200px] cq-sm:mt-20">
          <span aria-hidden className="absolute -left-1 -top-[0.42em] z-10 rotate-[-8deg] leading-none text-[#bff720]"
            style={{ ...DISPLAY, fontSize: 'clamp(3.2rem, 15cqw, 12rem)' }}>#</span>
          <h1 className="relative text-center uppercase leading-[0.86] tracking-[-0.045em]"
            style={{ ...DISPLAY, fontSize: 'clamp(2.3rem, 11.4cqw, 9.6rem)' }}>
            <span className="block">Diagnóstico</span>
            <span className="block">Estratégico</span>
            <span className="block">Digital</span>
          </h1>

          {/* Cards de vidro flutuando sobre o título (no celular, numa fileira logo abaixo) */}
          <div className="mt-8 flex items-start justify-center gap-3 pr-16 cq-sm:contents">
          <div className="dlp-float relative z-20 w-[46%] rotate-[6deg] cq-sm:absolute cq-sm:right-[2%] cq-sm:top-[18%] cq-sm:w-[34cqw] max-w-[220px] cq-sm:rotate-[8deg] rounded-[24px] border border-white/45 p-3 text-center cq-sm:rounded-[30px] cq-sm:p-5"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.42), rgba(255,255,255,0.14))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 24px 50px -24px rgba(3,20,70,0.7)' }}>
            <div className="mx-auto mb-2 w-fit"><Avatar size="h-11 w-11 cq-sm:h-16 cq-sm:w-16" /></div>
            <p className="truncate text-xs font-bold cq-sm:text-base">@{handle}</p>
            <p className="text-[10px] text-white/85 cq-sm:text-xs"><span className="tabular-nums">{media}%</span> de maturidade</p>
          </div>
          <div className="dlp-float-alt relative z-20 mt-6 w-[50%] rotate-[-6deg] cq-sm:absolute cq-sm:bottom-[-14%] cq-sm:left-[14%] cq-sm:mt-0 cq-sm:w-[36cqw] max-w-[230px] cq-sm:rotate-[-9deg] rounded-[24px] border border-white/45 p-3 cq-sm:rounded-[30px] cq-sm:p-5"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.42), rgba(255,255,255,0.14))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 24px 50px -24px rgba(3,20,70,0.7)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/85 cq-sm:text-[11px]">Veredito</p>
            <p className="mt-1 line-clamp-2 text-sm uppercase leading-tight cq-sm:text-lg" style={DISPLAY}>{final.destaque || 'Em análise'}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-[#bff720]" style={{ width: `${media}%` }} />
            </div>
          </div>

          </div>

          <CurveArrow className="absolute -top-[12%] right-[22%] z-10 hidden w-[17cqw] max-w-[140px] rotate-[6deg] cq-sm:block" />
          <LoopArrow className="absolute -bottom-[26%] left-[-2%] z-10 hidden w-[18cqw] max-w-[150px] cq-sm:block" />
          <Seal text="Diagnóstico gratuito • INOVA Co. • " className="absolute -bottom-6 right-0 z-30 w-24 rotate-[-12deg] cq-sm:-bottom-[34%] cq-sm:right-[2%] cq-sm:w-[24cqw] max-w-[170px]" />
        </div>

        <div className="relative z-10 mx-auto mt-14 flex max-w-xl flex-col items-center gap-5 text-center cq-sm:mt-[14cqw] cq-lg:mt-36">
          <p className="text-sm font-medium text-white/90 [text-wrap:pretty] cq-sm:text-base">
            Análise completa de performance digital e recomendações estratégicas para <strong className="font-bold text-white">@{handle}</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href="#veredito" className="inline-flex items-center gap-2 rounded-full bg-[#bff720] px-6 py-3 text-sm font-bold text-[#0b0d10] transition-transform active:scale-[0.97]">
              Ver plano de ação <ArrowRight size={16} />
            </a>
            <a href="#insights" className="rounded-full border-2 border-white px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#0a63de]">
              Ver insights
            </a>
          </div>
        </div>
      </section>

      {/* ── PANORAMA (bloco branco) ── */}
      <section id="panorama" className="relative z-10 -mt-10 mx-2 rounded-[32px] bg-white px-4 py-10 cq-sm:mx-4 cq-sm:rounded-[44px] cq-sm:px-10 cq-sm:py-14">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col gap-6 cq-lg:flex-row cq-lg:items-end cq-lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <Eyebrow>Panorama digital</Eyebrow>
              <h2 className="uppercase leading-[0.92] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(2rem, 7cqw, 4.2rem)' }}>
                Como sua marca<br />está hoje
              </h2>
              <div className="text-base leading-relaxed text-[#0b0d10]/70 cq-sm:text-lg">
                <Editable editing={canEdit} multiline value={introTexto} onChange={v => mutate(d => { d.intro = { ...(d.intro || {}), texto: v }; })} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Avatar size="h-11 w-11" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b0d10]/45">Analisado por</p>
                  <p className="font-bold">Especialistas INOVA Co.</p>
                </div>
              </div>
            </div>

            {/* Balão lima com a maturidade geral */}
            <div className="relative self-start cq-lg:self-auto">
              <div className="rounded-[32px] bg-[#bff720] px-7 py-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Maturidade geral</p>
                <p className="tabular-nums leading-none" style={{ ...DISPLAY, fontSize: 'clamp(2.8rem, 9cqw, 4.5rem)' }}>{media}%</p>
                <p className="mt-1 text-xs font-semibold">Verificado pela INOVA</p>
              </div>
              <div className="absolute -bottom-2 left-10 h-6 w-6 rotate-45 rounded-[4px] bg-[#bff720]" />
            </div>
          </div>

          <div className="relative mt-10 grid grid-cols-1 gap-3 cq-sm:grid-cols-2 cq-lg:gap-4 cq-xl:grid-cols-4">
            {pilares.map((p, idx) => {
              const val = Math.round(scores[p.key] || 0);
              return (
                <div key={p.key} className="relative rounded-[28px] bg-[#f1f3f6] p-5 text-center cq-sm:p-6">
                  <h3 className="text-xl uppercase leading-tight tracking-[-0.02em] cq-sm:text-2xl cq-xl:text-xl" style={DISPLAY}>{p.label}</h3>
                  <p className="mt-1 text-sm text-[#0b0d10]/60">{p.hint}</p>
                  <div className="mt-5 flex items-center gap-3 rounded-full bg-[#0a63de] p-1.5 pl-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
                      <div className="h-full rounded-full bg-[#bff720]" style={{ width: `${val}%` }} />
                    </div>
                    <span className="rounded-full bg-[#bff720] px-3 py-1.5 text-sm font-bold tabular-nums">{val}%</span>
                  </div>
                  {idx < pilares.length - 1 && (
                    <Scribble className="absolute -right-7 top-1/2 z-10 hidden w-10 -translate-y-1/2 cq-xl:block" width={8} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── INSIGHTS (azul) ── */}
      <section id="insights" className="relative overflow-hidden px-4 py-16 text-white cq-sm:px-8 cq-sm:py-24">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(50% 40% at 85% 10%, ${C.blueLight}55, transparent 70%)` }} />
        <div className="relative mx-auto max-w-[1200px]">
          <div className="relative mb-10 text-center cq-sm:mb-14">
            <h2 className="uppercase leading-[0.86] tracking-[-0.045em]" style={{ ...DISPLAY, fontSize: 'clamp(3rem, 14cqw, 10rem)' }}>
              Insights<span className="text-[#bff720]">.</span>
            </h2>
            <LoopArrow className="absolute -top-6 right-[4%] w-[16cqw] max-w-[120px] rotate-[200deg]" />
          </div>

          <div className="grid grid-cols-1 gap-10 cq-lg:grid-cols-2 cq-lg:gap-8">
            <div className="space-y-3">
              <div className="mb-4 flex items-center gap-3"><Eyebrow tone="lime">Pontos de força</Eyebrow></div>
              {positivos.map((p, i) => (
                <div key={i} className="relative flex items-start gap-4 rounded-[24px] bg-white p-4 text-[#0b0d10] cq-sm:p-5">
                  {canEdit && <RemoveButton label="Remover ponto" onClick={() => mutate(d => { d.positivos.splice(i, 1); })} />}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#bff720]"><CheckCircle2 size={20} /></span>
                  <div className="flex-1 pt-1.5 text-base font-bold leading-snug cq-sm:text-lg">
                    <Editable editing={canEdit} value={p} onChange={v => mutate(d => { d.positivos[i] = v; })} />
                  </div>
                </div>
              ))}
              {canEdit && <AddButton dark onClick={() => mutate(d => { d.positivos = [...(d.positivos || []), 'Novo ponto de força...']; })}>Adicionar ponto de força</AddButton>}
            </div>

            <div className="space-y-3">
              <div className="mb-4 flex items-center gap-3"><Eyebrow tone="outline">Gargalos de conversão</Eyebrow></div>
              {negativos.map((n, i) => (
                <div key={i} className="relative flex items-start gap-4 rounded-[24px] border border-white/25 bg-[#0849b0] p-4 cq-sm:p-5">
                  {canEdit && <RemoveButton label="Remover gargalo" onClick={() => mutate(d => { d.negativos.splice(i, 1); })} />}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15"><AlertCircle size={20} /></span>
                  <div className="flex-1 pt-1.5 text-base font-bold leading-snug text-white/95 cq-sm:text-lg">
                    <Editable editing={canEdit} value={n} onChange={v => mutate(d => { d.negativos[i] = v; })} />
                  </div>
                </div>
              ))}
              {canEdit && <AddButton dark onClick={() => mutate(d => { d.negativos = [...(d.negativos || []), 'Novo gargalo identificado...']; })}>Adicionar gargalo</AddButton>}
            </div>
          </div>
        </div>
      </section>

      {/* ── AUDITORIA DE PERFIL (só quando veio da IA) ── */}
      {ai && (
        <section className="mx-2 rounded-[32px] bg-white px-4 py-10 cq-sm:mx-4 cq-sm:rounded-[44px] cq-sm:px-10 cq-sm:py-14">
          <div className="mx-auto max-w-[1200px] space-y-10">
            <div className="space-y-4 text-center">
              <Eyebrow><Sparkles size={13} /> Auditoria detalhada</Eyebrow>
              <h2 className="uppercase leading-[0.92] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(2rem, 7cqw, 4.2rem)' }}>Análise de perfil</h2>
            </div>

            {printImage && (
              <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border-[6px] border-[#f1f3f6]">
                <img src={printImage} alt="Print da análise do perfil" loading="lazy" decoding="async" className="h-auto w-full" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 cq-lg:grid-cols-2 cq-lg:gap-4">
              {[
                { title: 'Biografia', pos: 'bioPositivos', neg: 'bioNegativos', dark: false },
                { title: 'Presença visual', pos: 'presencaPositivos', neg: 'presencaNegativos', dark: true },
              ].map(block => (
                <div key={block.title} className={`rounded-[28px] p-5 cq-sm:p-8 ${block.dark ? 'bg-[#0b0d10] text-white' : 'bg-[#f1f3f6]'}`}>
                  <h3 className="mb-5 text-2xl uppercase tracking-[-0.02em]" style={DISPLAY}>{block.title}</h3>
                  <div className="space-y-3">
                    {(ai[block.pos] || []).map((t: string, i: number) => (
                      <div key={`p${i}`} className="flex items-start gap-3 font-bold">
                        <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${block.dark ? 'text-[#bff720]' : 'text-[#0a63de]'}`} />
                        <div className="flex-1"><Editable editing={canEdit} value={t} onChange={v => mutate(d => { d.aiAnalise[block.pos][i] = v; })} /></div>
                      </div>
                    ))}
                    {(ai[block.neg] || []).map((t: string, i: number) => (
                      <div key={`n${i}`} className={`flex items-start gap-3 ${block.dark ? 'text-white/65' : 'text-[#0b0d10]/60'}`}>
                        <AlertCircle size={18} className="mt-0.5 shrink-0 opacity-70" />
                        <div className="flex-1"><Editable editing={canEdit} value={t} onChange={v => mutate(d => { d.aiAnalise[block.neg][i] = v; })} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── VEREDITO + PLANO DE AÇÃO (bloco preto) ── */}
      <section id="veredito" className={`relative mx-2 overflow-hidden rounded-[32px] bg-[#0b0d10] px-4 py-14 text-white cq-sm:mx-4 cq-sm:rounded-[44px] cq-sm:px-10 cq-sm:py-20 ${ai ? 'mt-2 cq-sm:mt-4' : ''}`}>
        <div className="relative mx-auto max-w-4xl text-center">
          <Eyebrow tone="lime">O veredito final</Eyebrow>
          <h2 className="mt-6 break-words uppercase leading-[0.9] tracking-[-0.04em]" style={{ ...DISPLAY, fontSize: 'clamp(2.4rem, 9cqw, 6.5rem)' }}>
            <Editable editing={canEdit} value={final.destaque || ''} onChange={v => mutate(d => { d.final.destaque = v; })} />
          </h2>
          <Underline className="mx-auto mt-2 h-5 w-[60%] max-w-[360px]" />
          <div className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 cq-sm:text-xl">
            <Editable editing={canEdit} multiline value={final.texto || ''} onChange={v => mutate(d => { d.final.texto = v; })} />
          </div>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-4xl gap-3">
          {[1, 2, 3, 4, 5].map(i => (final[`acao${i}`] || canEdit) ? (
            <div key={i} className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-white/[0.06] p-3 pr-5 cq-sm:p-4 cq-sm:pr-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#bff720] text-base text-[#0b0d10] tabular-nums cq-sm:h-12 cq-sm:w-12" style={DISPLAY}>
                {String(i).padStart(2, '0')}
              </span>
              <div className="flex-1 text-base font-bold leading-snug cq-sm:text-lg">
                <Editable editing={canEdit} value={final[`acao${i}`] || ''} onChange={v => mutate(d => { d.final[`acao${i}`] = v; })} />
              </div>
            </div>
          ) : null)}
        </div>
        <CurveArrow className="pointer-events-none absolute -right-4 top-6 hidden w-28 rotate-[100deg] opacity-90 cq-md:block" />
      </section>

      {/* ── CRONOGRAMA (bloco branco) ── */}
      <section id="cronograma" className="mx-2 mt-2 rounded-[32px] bg-white px-4 py-10 cq-sm:mx-4 cq-sm:mt-4 cq-sm:rounded-[44px] cq-sm:px-10 cq-sm:py-14">
        <div className="mx-auto max-w-[1200px] space-y-14">
          <div className="space-y-4 text-center">
            <Eyebrow>Cronograma</Eyebrow>
            <h2 className="uppercase leading-[0.92] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(2rem, 7cqw, 4.2rem)' }}>Mão na massa,<br />semana a semana</h2>
          </div>

          {semanas.map((s, i) => (
            <div key={i} className="relative space-y-5">
              {canEdit && (
                <button type="button"
                  onClick={() => { if (confirm('Excluir esta semana inteira?')) mutate(d => { d.semanas.splice(i, 1); }); }}
                  className="absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-[#e5484d] px-3 py-1.5 text-xs font-bold text-white">
                  <Trash2 size={13} /> Excluir semana
                </button>
              )}
              <div className="flex flex-col gap-3 cq-sm:flex-row cq-sm:items-end cq-sm:gap-5">
                <span className="w-fit rounded-full bg-[#0a63de] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white">
                  <Editable editing={canEdit} value={s.label || ''} onChange={v => mutate(d => { d.semanas[i].label = v; })} />
                </span>
                <h3 className="flex-1 uppercase leading-[0.95] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 5.2cqw, 3rem)' }}>
                  <Editable editing={canEdit} value={s.titulo || ''} onChange={v => mutate(d => { d.semanas[i].titulo = v; })} />
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 cq-lg:grid-cols-2 cq-lg:gap-4">
                {(s.cards || []).map((c: any, ci: number) => (
                  <div key={ci} className="relative flex flex-col gap-5 rounded-[28px] bg-[#f1f3f6] p-5 cq-sm:p-7">
                    {canEdit && <RemoveButton label="Remover ideia" onClick={() => mutate(d => { d.semanas[i].cards.splice(ci, 1); })} />}
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-[#0a63de] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                        <Editable editing={canEdit} value={c.tipo || ''} onChange={v => mutate(d => { d.semanas[i].cards[ci].tipo = v; })} />
                      </span>
                      <Scribble className="w-10 shrink-0" width={8} />
                    </div>
                    <h4 className="break-words text-2xl uppercase leading-tight tracking-[-0.02em] cq-sm:text-[28px]" style={DISPLAY}>
                      <Editable editing={canEdit} value={c.titulo || ''} onChange={v => mutate(d => { d.semanas[i].cards[ci].titulo = v; })} />
                    </h4>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0a63de]">Base estratégica</p>
                      <div className="mt-1 text-base font-medium leading-relaxed text-[#0b0d10]/75">
                        <Editable editing={canEdit} multiline value={c.gancho || ''} onChange={v => mutate(d => { d.semanas[i].cards[ci].gancho = v; })} />
                      </div>
                    </div>
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b0d10]/45">Estrutura do conteúdo</p>
                      <div className="mt-1 font-bold leading-relaxed text-[#0b0d10]/85">
                        <Editable editing={canEdit} multiline value={c.estrutura || ''} onChange={v => mutate(d => { d.semanas[i].cards[ci].estrutura = v; })} />
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b0d10]/50">Chamada</span>
                      <span className="rounded-full bg-[#bff720] px-4 py-2 text-sm font-bold">
                        <Editable editing={canEdit} value={c.cta || ''} onChange={v => mutate(d => { d.semanas[i].cards[ci].cta = v; })} />
                      </span>
                    </div>
                  </div>
                ))}
                {canEdit && (
                  <AddButton onClick={() => mutate(d => {
                    d.semanas[i].cards = [...(d.semanas[i].cards || []), { tipo: 'Novo vídeo', titulo: 'Título da ideia', gancho: 'Chamada de impacto aqui', estrutura: 'Passo a passo do vídeo', cta: 'Postar agora' }];
                  })}>Adicionar ideia de vídeo</AddButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RODAPÉ / CTA ── */}
      <footer className="relative overflow-hidden px-4 pb-28 pt-16 cq-sm:pb-12 text-center text-white cq-sm:px-8 cq-sm:pt-24">
        <div className="relative mx-auto max-w-4xl">
          <h2 className="uppercase leading-[0.88] tracking-[-0.045em]" style={{ ...DISPLAY, fontSize: 'clamp(2.2rem, 8.5cqw, 6.4rem)' }}>
            Bora transformar<br />isso em <span className="text-[#bff720]">resultado?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/85 [text-wrap:pretty]">
            A INOVA Co. cuida da sua comunicação de ponta a ponta: criativo, estratégia, otimização e escala.
          </p>
          <div className="mt-8 flex justify-center">
            {ctaHref ? (
              <a href={ctaHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#bff720] px-7 py-4 text-base font-bold text-[#0b0d10] transition-transform active:scale-[0.97]">
                Quero ajuda para aplicar o plano <ArrowRight size={18} />
              </a>
            ) : (
              <span className="inline-flex rounded-full bg-[#bff720] px-7 py-4 text-base font-bold text-[#0b0d10]">Quero ajuda para aplicar o plano</span>
            )}
          </div>
          <Seal text="Estratégia • Conteúdo • Resultado • " className="relative mx-auto mt-12 w-28 cq-sm:absolute cq-sm:-right-6 cq-sm:top-0 cq-sm:mt-0 cq-sm:w-36" />
          <img src={LogoInova} alt="INOVA Co." className="mx-auto mt-12 h-8 brightness-0 invert opacity-90" />
          <p className="mt-6 break-words text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
            Documento confidencial e exclusivo para @{handle}.<br />
            © {new Date().getFullYear()} INOVA Co.{insta ? ` · @${insta}` : ''}
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes dlp-spin { to { transform: rotate(360deg); } }
        @keyframes dlp-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
        .diagnostic-report .dlp-spin { animation: dlp-spin 18s linear infinite; transform-origin: 50% 50%; }
        .diagnostic-report .dlp-float { animation: dlp-float 6s ease-in-out infinite; }
        .diagnostic-report .dlp-float-alt { animation: dlp-float 7s ease-in-out -2s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .diagnostic-report .dlp-spin, .diagnostic-report .dlp-float, .diagnostic-report .dlp-float-alt { animation: none; }
        }
      `}</style>
    </div>
  );
}
