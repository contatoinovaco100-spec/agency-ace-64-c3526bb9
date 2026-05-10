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
