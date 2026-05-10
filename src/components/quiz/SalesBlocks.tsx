import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, Clock, Users, Shield, MessageCircle, ArrowRight, Star, ChevronLeft, ChevronRight } from "lucide-react";
import type { QuizTheme } from "@/lib/quizTheme";

interface BlockProps {
  config: Record<string, any>;
  theme: QuizTheme;
  onNext?: () => void;
}

/* ─── ESCASSEZ COM CONTADOR ─── */
export function ScarcityBlock({ config, theme }: BlockProps) {
  const { text = "", slots_total = 10, slots_filled = 7, show_timer, timer_minutes = 15 } = config;
  const remaining = Math.max(0, slots_total - slots_filled);
  const pct = (slots_filled / slots_total) * 100;

  const [timeLeft, setTimeLeft] = useState(() => {
    if (!show_timer) return 0;
    const key = `quiz_timer_${timer_minutes}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const diff = Math.max(0, Math.floor((Number(saved) - Date.now()) / 1000));
      return diff > 0 ? diff : timer_minutes * 60;
    }
    const end = Date.now() + timer_minutes * 60 * 1000;
    localStorage.setItem(key, String(end));
    return timer_minutes * 60;
  });

  useEffect(() => {
    if (!show_timer || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [show_timer, timeLeft]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #dc2626, #ea580c)", color: "#fff" }}>
      <div className="p-5 space-y-3">
        <p className="text-base font-bold text-center">
          {text.replace("{n}", String(remaining))}
        </p>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#fff" }} />
        </div>
        <p className="text-xs text-center opacity-80">{slots_filled} de {slots_total} vagas preenchidas</p>
        {show_timer && timeLeft > 0 && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-black/20 rounded-lg px-4 py-2">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="font-mono text-lg font-bold">{fmt(timeLeft)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PROVA SOCIAL ─── */
export function SocialProofBlock({ config, theme }: BlockProps) {
  const { text = "", count = 127, show_animation } = config;
  const [displayed, setDisplayed] = useState(count);

  useEffect(() => {
    if (!show_animation) return;
    const t = setInterval(() => {
      setDisplayed(p => p + 1);
    }, 8000 + Math.random() * 7000);
    return () => clearInterval(t);
  }, [show_animation]);

  return (
    <div className="rounded-xl p-5 text-center" style={{ backgroundColor: `${theme.primary_color}10`, border: `1px solid ${theme.primary_color}30` }}>
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#ef4444" }} />
          <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: "#ef4444" }} />
        </span>
        <Users className="h-5 w-5" style={{ color: theme.primary_color }} />
      </div>
      <p className="text-lg font-bold" style={{ color: theme.text_color }}>
        {text.replace("{n}", String(displayed))}
      </p>
    </div>
  );
}

/* ─── DEPOIMENTOS CARROSSEL ─── */
interface Testimonial { name: string; role: string; text: string; stars: number; photo_url?: string; }

export function TestimonialsBlock({ config, theme }: BlockProps) {
  const items: Testimonial[] = config.items ?? [];
  const autoplay = config.autoplay_seconds ?? 0;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!autoplay || items.length <= 1) return;
    const t = setInterval(() => setIdx(p => (p + 1) % items.length), autoplay * 1000);
    return () => clearInterval(t);
  }, [autoplay, items.length]);

  if (!items.length) return null;
  const item = items[idx];

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
      <div className="flex justify-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4" style={{ color: i < item.stars ? "#facc15" : "rgba(255,255,255,0.15)", fill: i < item.stars ? "#facc15" : "none" }} />
        ))}
      </div>
      <p className="text-center italic opacity-90" style={{ color: theme.text_color }}>"{item.text}"</p>
      <div className="flex items-center justify-center gap-3">
        {item.photo_url && <img src={item.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
        <div className="text-sm">
          <div className="font-semibold" style={{ color: theme.text_color }}>{item.name}</div>
          {item.role && <div className="text-xs opacity-60">{item.role}</div>}
        </div>
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setIdx((idx - 1 + items.length) % items.length)} className="opacity-50 hover:opacity-100 transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: i === idx ? theme.primary_color : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
          <button onClick={() => setIdx((idx + 1) % items.length)} className="opacity-50 hover:opacity-100 transition">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── CTA WHATSAPP ─── */
export function CtaWhatsAppBlock({ config, theme }: BlockProps) {
  const { phone = "", message = "", button_text = "Falar com especialista", above_text = "" } = config;
  const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <div className="rounded-xl p-5 text-center space-y-3" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
      {above_text && <p className="text-sm font-medium opacity-80">{above_text}</p>}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-95"
        style={{ backgroundColor: "#25D366", animation: "whatsappPulse 2s infinite" }}
      >
        <MessageCircle className="h-6 w-6" />
        {button_text}
      </a>
      <style>{`@keyframes whatsappPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.4); } 50% { box-shadow: 0 0 0 12px rgba(37,211,102,0); } }`}</style>
    </div>
  );
}

/* ─── CTA ANCORAGEM DE PREÇO ─── */
export function CtaPriceBlock({ config, theme }: BlockProps) {
  const { original_price, current_price, discount_badge, button_text, button_url, urgency_text, guarantee_text } = config;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${theme.primary_color}` }}>
      <div className="p-6 space-y-4 text-center" style={{ backgroundColor: theme.card_background }}>
        {discount_badge && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#dc2626" }}>
            {discount_badge}
          </span>
        )}
        <div className="space-y-1">
          {original_price && (
            <p className="text-lg line-through opacity-40" style={{ color: theme.text_color }}>De R$ {original_price}</p>
          )}
          <p className="text-4xl font-bold" style={{ color: theme.primary_color }}>
            R$ {current_price}
          </p>
        </div>
        {button_url && (
          <a
            href={button_url}
            target="_blank"
            rel="noreferrer"
            className="w-full inline-block py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: theme.primary_color, color: theme.button_text_color, boxShadow: `0 4px 20px ${theme.primary_color}40` }}
          >
            {button_text || "Quero aproveitar"} →
          </a>
        )}
        {urgency_text && (
          <p className="text-xs font-medium opacity-70 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> {urgency_text}
          </p>
        )}
        {guarantee_text && (
          <p className="text-xs opacity-50 flex items-center justify-center gap-1">
            <Shield className="h-3 w-3" /> {guarantee_text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── AUTORIDADE (LOGOS) ─── */
export function AuthorityBlock({ config, theme }: BlockProps) {
  const { title = "", logos = [] } = config;

  return (
    <div className="rounded-xl p-5 space-y-4 text-center" style={{ backgroundColor: `${theme.primary_color}05` }}>
      {title && <p className="text-sm font-medium opacity-70">{title}</p>}
      {logos.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-6">
          {logos.map((url: string, i: number) => (
            <img key={i} src={url} alt="" className="h-10 object-contain opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
          ))}
        </div>
      ) : (
        <p className="text-xs opacity-40">Adicione logos no editor</p>
      )}
    </div>
  );
}

/* ─── ANTES E DEPOIS ─── */
export function BeforeAfterBlock({ config, theme }: BlockProps) {
  const { before_title, before_items = [], after_title, after_items = [] } = config;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Before */}
      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <h4 className="text-sm font-bold text-center" style={{ color: "#ef4444" }}>❌ {before_title}</h4>
        <ul className="space-y-2">
          {before_items.map((item: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm opacity-80">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* After */}
      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}30` }}>
        <h4 className="text-sm font-bold text-center" style={{ color: theme.primary_color }}>✅ {after_title}</h4>
        <ul className="space-y-2">
          {after_items.map((item: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm opacity-90">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.primary_color }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── TABELA COMPARATIVA ─── */
interface CompRow { feature: string; col1: boolean; col2: boolean; }

export function ComparisonTableBlock({ config, theme }: BlockProps) {
  const { col1_title, col2_title, col2_badge, rows = [] } = config;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.primary_color}30` }}>
      <table className="w-full text-sm" style={{ color: theme.text_color }}>
        <thead>
          <tr style={{ backgroundColor: `${theme.primary_color}10` }}>
            <th className="text-left p-3 font-medium opacity-70">Recurso</th>
            <th className="p-3 text-center font-medium opacity-70">{col1_title}</th>
            <th className="p-3 text-center font-bold" style={{ color: theme.primary_color }}>
              {col2_title}
              {col2_badge && (
                <span className="block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 mx-auto w-fit" style={{ backgroundColor: theme.primary_color, color: theme.button_text_color }}>
                  {col2_badge}
                </span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {(rows as CompRow[]).map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="p-3">{row.feature}</td>
              <td className="p-3 text-center">
                {row.col1 ? <CheckCircle2 className="h-5 w-5 mx-auto text-green-400" /> : <XCircle className="h-5 w-5 mx-auto text-red-400 opacity-40" />}
              </td>
              <td className="p-3 text-center" style={{ backgroundColor: `${theme.primary_color}05` }}>
                {row.col2 ? <CheckCircle2 className="h-5 w-5 mx-auto" style={{ color: theme.primary_color }} /> : <XCircle className="h-5 w-5 mx-auto text-red-400 opacity-40" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── GAUGE CHART (VELOCÍMETRO) ─── */
export function GaugeChartBlock({ config, theme }: BlockProps) {
  const { score = 67, max_score = 100, label = "Sua pontuação", zones = [] } = config;
  const pct = Math.min(100, (score / max_score) * 100);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    let frame: number;
    let start: number;
    const duration = 1500;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const currentZone = (zones as any[]).find((z, i, arr) => {
    const prev = i > 0 ? arr[i - 1].max : 0;
    return pct > prev && pct <= z.max;
  }) ?? zones[zones.length - 1];

  const angle = -90 + (pct / 100) * 180;
  const r = 80;
  const cx = 100, cy = 95;

  return (
    <div className="rounded-xl p-6 text-center space-y-4" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
      <svg viewBox="0 0 200 120" className="w-full max-w-[280px] mx-auto">
        {/* Background arc */}
        {(zones as any[]).map((zone: any, i: number) => {
          const prevMax = i > 0 ? (zones as any[])[i - 1].max : 0;
          const startAngle = -90 + (prevMax / 100) * 180;
          const endAngle = -90 + (zone.max / 100) * 180;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          const large = endAngle - startAngle > 180 ? 1 : 0;
          return (
            <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none" stroke={zone.color} strokeWidth="12" strokeLinecap="round" opacity={0.25} />
          );
        })}
        {/* Active arc */}
        <path
          d={`M ${cx + r * Math.cos(-Math.PI / 2)} ${cy + r * Math.sin(-Math.PI / 2)} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${cx + r * Math.cos((angle * Math.PI) / 180)} ${cy + r * Math.sin((angle * Math.PI) / 180)}`}
          fill="none" stroke={currentZone?.color || theme.primary_color} strokeWidth="12" strokeLinecap="round"
          style={{ transition: "all 1.5s ease-out" }}
        />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="28" fontWeight="bold" fill={currentZone?.color || theme.primary_color}>
          {animated}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill={theme.text_color} opacity={0.6}>
          {currentZone?.name || ""}
        </text>
      </svg>
      <p className="text-sm font-medium opacity-70">{label}</p>
    </div>
  );
}

/* ─── BARRA DE PROGRESSO MOTIVACIONAL ─── */
interface ProgressMotivationalProps {
  config: Record<string, any>;
  theme: QuizTheme;
  progress: number; // 0-100
}

export function ProgressMotivationalBlock({ config, theme, progress }: ProgressMotivationalProps) {
  const ranges = (config.ranges ?? []) as { min: number; max: number; text: string }[];
  const current = ranges.find(r => progress >= r.min && progress <= r.max) ?? ranges[ranges.length - 1];

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${theme.primary_color}, ${theme.primary_color}cc)` }} />
      </div>
      <p className="text-sm text-center font-medium" style={{ color: theme.primary_color }}>
        {current?.text || `${Math.round(progress)}% concluído`}
      </p>
    </div>
  );
}

/* ─── TOAST DE PROVA SOCIAL ─── */
interface ToastSocialProps {
  config: Record<string, any>;
  theme: QuizTheme;
  active: boolean;
}

export function ToastSocialOverlay({ config, theme, active }: ToastSocialProps) {
  const items = (config.items ?? []) as { name: string; city: string }[];
  const interval = (config.interval_seconds ?? 8) * 1000;
  const actionText = config.action_text ?? "acabou de se inscrever";
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!active || !items.length) return;
    const show = () => {
      setCurrent(Math.floor(Math.random() * items.length));
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };
    const t = setInterval(show, interval);
    const initial = setTimeout(show, 3000);
    return () => { clearInterval(t); clearTimeout(initial); };
  }, [active, items.length, interval]);

  if (!visible || !items.length) return null;
  const item = items[current];

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-[toastSlideIn_0.4s_ease-out]" style={{ maxWidth: 300 }}>
      <div className="rounded-xl p-3 shadow-lg flex items-center gap-3" style={{ backgroundColor: theme.card_background, border: `1px solid ${theme.primary_color}30`, color: theme.text_color }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${theme.primary_color}20`, color: theme.primary_color }}>
          {item.name.charAt(0)}
        </div>
        <div className="text-xs">
          <span className="font-semibold">{item.name}</span> de {item.city}
          <br />
          <span className="opacity-60">{actionText} • agora</span>
        </div>
      </div>
      <style>{`@keyframes toastSlideIn { from { transform: translateX(-120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

/* ─── EXIT INTENT POPUP ─── */
interface ExitIntentProps {
  config: Record<string, any>;
  theme: QuizTheme;
  onClose: () => void;
}

export function ExitIntentPopup({ config, theme, onClose }: ExitIntentProps) {
  const { title = "Espera!", text = "", button_text = "Continuar" } = config;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl p-8 max-w-sm w-full text-center space-y-4 animate-[exitBounce_0.4s_ease-out]"
        style={{ backgroundColor: theme.card_background, color: theme.text_color, border: `2px solid ${theme.primary_color}` }}>
        <div className="text-4xl">⚠️</div>
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="opacity-70">{text}</p>
        <button
          onClick={onClose}
          className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: theme.primary_color, color: theme.button_text_color, boxShadow: `0 4px 20px ${theme.primary_color}40` }}
        >
          {button_text}
        </button>
        <button onClick={onClose} className="text-xs opacity-40 hover:opacity-70 transition">
          Fechar
        </button>
      </div>
      <style>{`@keyframes exitBounce { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

/* ─── REVELAÇÃO PROGRESSIVA ─── */
export function ProgressiveRevealBlock({ config, theme }: BlockProps) {
  const { loading_text = "Calculando...", loading_seconds = 3, reveal_steps = [] } = config;
  const [phase, setPhase] = useState(0); // 0=loading, 1+=reveal steps

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), loading_seconds * 1000);
      return () => clearTimeout(t);
    }
    if (phase > 0 && phase <= (reveal_steps as any[]).length) {
      const t = setTimeout(() => setPhase(p => p + 1), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, loading_seconds, reveal_steps]);

  if (phase === 0) {
    return (
      <div className="rounded-xl p-8 text-center space-y-4" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full animate-spin" style={{ border: `3px solid ${theme.primary_color}30`, borderTopColor: theme.primary_color }} />
        <p className="text-base font-medium animate-pulse" style={{ color: theme.primary_color }}>{loading_text}</p>
      </div>
    );
  }

  const visibleSteps = (reveal_steps as any[]).slice(0, phase);

  return (
    <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: `${theme.primary_color}08`, border: `1px solid ${theme.primary_color}20` }}>
      {visibleSteps.map((step: any, i: number) => (
        <div key={i} className="animate-[revealFade_0.6s_ease-out]" style={{ animationDelay: `${i * 0.1}s` }}>
          {step.type === "score" && (
            <div className="text-center">
              <p className="text-xs opacity-60 mb-1">{step.label}</p>
              <p className="text-4xl font-bold" style={{ color: theme.primary_color }}>{step.value ?? "—"}</p>
            </div>
          )}
          {step.type === "classification" && (
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${theme.primary_color}15` }}>
              <p className="text-xs opacity-60 mb-1">{step.label}</p>
              <p className="text-xl font-bold" style={{ color: theme.primary_color }}>{step.value ?? "—"}</p>
            </div>
          )}
          {step.type === "recommendation" && (
            <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${theme.primary_color}` }}>
              <p className="text-sm opacity-90">{step.text}</p>
            </div>
          )}
        </div>
      ))}
      <style>{`@keyframes revealFade { from { opacity: 0; transform: translateY(10px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }`}</style>
    </div>
  );
}

/* ─── CALCULADORA DE ROI ─── */
export function RoiCalculatorBlock({ config, theme }: BlockProps) {
  const { prefix = "R$ ", value = "15.000", suffix = " / mês", label = "Seu potencial de resultado", disclaimer = "" } = config;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${theme.primary_color}` }}>
      <div className="p-6 text-center space-y-3" style={{ backgroundColor: theme.card_background }}>
        <p className="text-sm font-medium opacity-80" style={{ color: theme.text_color }}>{label}</p>
        <div className="text-4xl sm:text-5xl font-extrabold flex items-center justify-center gap-1" style={{ color: theme.primary_color }}>
          <span className="text-2xl opacity-70">{prefix}</span>
          <span className="animate-[countUp_2s_ease-out]">{value}</span>
          <span className="text-xl opacity-70">{suffix}</span>
        </div>
        {disclaimer && <p className="text-[10px] opacity-40 mt-4">{disclaimer}</p>}
      </div>
      <style>{`@keyframes countUp { from { opacity: 0; transform: translateY(20px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }`}</style>
    </div>
  );
}

/* ─── TERMÔMETRO DE MATURIDADE ─── */
export function MaturityThermometerBlock({ config, theme }: BlockProps) {
  const { score = 50, max_score = 100, levels = [] } = config;
  const pct = Math.min(100, Math.max(0, (score / max_score) * 100));

  const currentLevel = (levels as any[]).find((l, i, arr) => {
    const prev = i > 0 ? arr[i - 1].max : 0;
    return pct > prev && pct <= l.max;
  }) ?? levels[levels.length - 1];

  return (
    <div className="rounded-xl p-5 space-y-6" style={{ backgroundColor: `${theme.primary_color}05`, border: `1px solid ${theme.primary_color}20` }}>
      {/* Thermometer Bar */}
      <div className="relative h-4 rounded-full w-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        {/* Markers */}
        {(levels as any[]).map((l: any, i: number) => (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${l.max}%` }} />
        ))}
        {/* Fill */}
        <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${theme.primary_color}80, ${currentLevel?.color || theme.primary_color})` }} />
        {/* Needle */}
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-6 bg-white rounded shadow-lg transition-all duration-1000 ease-out z-10 flex items-center justify-center"
          style={{ left: `calc(${pct}% - 8px)`, border: `2px solid ${currentLevel?.color || theme.primary_color}` }}>
          <div className="w-1 h-2 rounded-full" style={{ backgroundColor: currentLevel?.color || theme.primary_color }} />
        </div>
      </div>

      {/* Result Card */}
      <div className="rounded-lg p-4 text-center space-y-2 animate-[revealFade_0.5s_ease-out_0.5s_both]"
        style={{ backgroundColor: `${currentLevel?.color || theme.primary_color}15`, border: `1px solid ${currentLevel?.color || theme.primary_color}40` }}>
        <p className="text-xs opacity-70">Você está no nível:</p>
        <p className="text-xl font-bold" style={{ color: currentLevel?.color || theme.primary_color }}>
          {currentLevel?.name || "..."}
        </p>
        {currentLevel?.desc && <p className="text-sm opacity-90">{currentLevel.desc}</p>}
      </div>
    </div>
  );
}

/* ─── PLANOS (PRICING) ─── */
export function PricingPlansBlock({ config, theme }: BlockProps) {
  const plans = (config.plans ?? []) as any[];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {plans.map((p, i) => (
        <div key={i} className="rounded-xl p-5 flex flex-col space-y-4 relative overflow-hidden transition-transform hover:-translate-y-1"
          style={{
            backgroundColor: p.is_popular ? `${theme.primary_color}10` : theme.card_background,
            border: `2px solid ${p.is_popular ? theme.primary_color : `${theme.primary_color}30`}`
          }}>
          {p.is_popular && (
            <div className="absolute top-0 right-0 left-0 bg-primary text-center text-[10px] font-bold py-1 uppercase tracking-wider"
              style={{ backgroundColor: theme.primary_color, color: theme.button_text_color }}>
              Mais popular
            </div>
          )}
          <div className={p.is_popular ? "pt-4" : ""}>
            <h3 className="text-lg font-bold">{p.name}</h3>
            <div className="text-3xl font-extrabold mt-2" style={{ color: theme.primary_color }}>R$ {p.price}</div>
          </div>
          <ul className="space-y-2 flex-1">
            {(p.features ?? []).map((f: string, j: number) => (
              <li key={j} className="flex items-start gap-2 text-sm opacity-80">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.primary_color }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {p.button_url && (
            <a href={p.button_url} target="_blank" rel="noreferrer" className="w-full py-3 rounded-lg text-center font-bold transition-all text-sm block"
              style={{
                backgroundColor: p.is_popular ? theme.primary_color : "transparent",
                color: p.is_popular ? theme.button_text_color : theme.text_color,
                border: `1px solid ${theme.primary_color}`
              }}>
              {p.button_text || "Escolher"}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── FORMULÁRIO PÓS-RESULTADO ─── */
export function PostResultFormBlock({ config, theme }: BlockProps) {
  const { title = "Receba seu diagnóstico completo no e-mail:", button_text = "Enviar", fields = {} } = config;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setDone(true); }, 1500);
  };

  if (done) {
    return (
      <div className="rounded-xl p-6 text-center space-y-3" style={{ backgroundColor: `${theme.primary_color}15`, border: `1px solid ${theme.primary_color}30` }}>
        <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: theme.primary_color }} />
        <p className="font-bold">Tudo certo!</p>
        <p className="text-sm opacity-80">Suas informações foram salvas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: `${theme.primary_color}05`, border: `1px solid ${theme.primary_color}20` }}>
      <p className="text-center font-medium mb-5" style={{ color: theme.text_color }}>{title}</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {fields.name && (
          <input required type="text" placeholder="Seu nome" className="w-full p-3 rounded-lg text-sm bg-black/20 border-white/10 outline-none focus:border-primary transition-colors" />
        )}
        {fields.email && (
          <input required type="email" placeholder="Seu melhor e-mail" className="w-full p-3 rounded-lg text-sm bg-black/20 border-white/10 outline-none focus:border-primary transition-colors" />
        )}
        {fields.phone && (
          <input required type="tel" placeholder="WhatsApp" className="w-full p-3 rounded-lg text-sm bg-black/20 border-white/10 outline-none focus:border-primary transition-colors" />
        )}
        {fields.company && (
          <input required type="text" placeholder="Sua empresa" className="w-full p-3 rounded-lg text-sm bg-black/20 border-white/10 outline-none focus:border-primary transition-colors" />
        )}
        <button type="submit" disabled={submitting} className="w-full py-3 mt-2 rounded-lg font-bold transition-all disabled:opacity-50"
          style={{ backgroundColor: theme.primary_color, color: theme.button_text_color }}>
          {submitting ? "Enviando..." : button_text}
        </button>
      </form>
    </div>
  );
}
