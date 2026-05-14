import { lazy, Suspense } from "react";
import { type QuizTheme } from "@/lib/quizTheme";
import { Check } from "lucide-react";

// Lazy load blocks to keep renderer light
const ScarcityBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ScarcityBlock })));
const SocialProofBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.SocialProofBlock })));
const TestimonialsBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.TestimonialsBlock })));
const CtaWhatsAppBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.CtaWhatsAppBlock })));
const CtaPriceBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.CtaPriceBlock })));
const AuthorityBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.AuthorityBlock })));
const BeforeAfterBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.BeforeAfterBlock })));
const ComparisonTableBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ComparisonTableBlock })));
const GaugeChartBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.GaugeChartBlock })));
const ProgressMotivationalBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ProgressMotivationalBlock })));
const ProgressiveRevealBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ProgressiveRevealBlock })));
const RoiCalculatorBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.RoiCalculatorBlock })));
const MaturityThermometerBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.MaturityThermometerBlock })));
const PricingPlansBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.PricingPlansBlock })));
const PostResultFormBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.PostResultFormBlock })));
const AlertBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.AlertBlock })));
const ArgumentsBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ArgumentsBlock })));
const AudioBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.AudioBlock })));
const VideoBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.VideoBlock })));
const SpacerBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.SpacerBlock })));
const HtmlBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.HtmlBlock })));
const FakeLoadingBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.FakeLoadingBlock })));
const CircularProgressBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.CircularProgressBlock })));
const HighlightTextBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.HighlightTextBlock })));
const ImpactSummaryBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ImpactSummaryBlock })));
const InfiniteMarqueeBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.InfiniteMarqueeBlock })));
const ScrollToOfferBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ScrollToOfferBlock })));
const IconInfoBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.IconInfoBlock })));
const FaqBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.FaqBlock })));

export type VisualElement =
  | { id: string; type: "heading"; text: string; align?: "left" | "center" | "right"; size?: "sm" | "md" | "lg" | "xl" }
  | { id: string; type: "paragraph"; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "image"; url: string; align?: "left" | "center" | "right" }
  | { id: string; type: "bullets"; items: string[]; align?: "left" | "center" | "right" }
  | { id: string; type: "button"; label: string; url: string; align?: "left" | "center" | "right"; action?: "link" | "next" }
  | { id: string; type: string; [key: string]: any };

export function renderVisualElements(elements: VisualElement[], theme: QuizTheme, onNext: () => void) {
  return (
    <div className="space-y-4">
      {elements.map((el) => {
        let content = null;
        const alignClass = el.align === "left" ? "text-left" : el.align === "right" ? "text-right" : "text-center";
        const flexClass = el.align === "left" ? "justify-start" : el.align === "right" ? "justify-end" : "justify-center";

        if (el.type === "heading") {
          const size = el.size === "sm" ? "text-lg" : el.size === "lg" ? "text-3xl" : el.size === "xl" ? "text-4xl" : "text-2xl";
          content = <h3 className={`${size} font-bold ${alignClass}`} style={{ color: theme.text_color }}>{el.text}</h3>;
        } 
        else if (el.type === "paragraph") content = <p className={`text-base opacity-80 ${alignClass}`}>{el.text}</p>;
        else if (el.type === "image") content = <img src={el.url} alt="" className={`max-w-full rounded-lg mx-auto ${el.align === "left" ? "ml-0" : el.align === "right" ? "mr-0" : ""}`} loading="lazy" />;
        else if (el.type === "bullets") {
          content = (
            <ul className={`space-y-2 ${alignClass}`}>
              {(el.items || []).map((it, i) => (
                <li key={i} className={`flex items-start gap-2 ${el.align === "right" ? "flex-row-reverse" : ""}`}>
                  <Check className="h-4 w-4 mt-1 shrink-0" style={{ color: theme.primary_color }} />
                  <span className="text-sm opacity-90">{it}</span>
                </li>
              ))}
            </ul>
          );
        }
        else if (el.type === "button") {
          content = (
            <div className={`flex ${flexClass}`}>
              <button
                onClick={() => el.action === "next" ? onNext() : window.open(el.url, "_blank")}
                className="px-8 py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                style={{ backgroundColor: theme.primary_color, color: theme.button_text_color }}
              >
                {el.label}
              </button>
            </div>
          );
        }
        // Lazy blocks
        else if (el.type === "scarcity") content = <ScarcityBlock config={el} theme={theme as any} />;
        else if (el.type === "social_proof") content = <SocialProofBlock config={el} theme={theme as any} />;
        else if (el.type === "testimonials") content = <TestimonialsBlock config={el} theme={theme as any} />;
        else if (el.type === "cta_whatsapp") content = <CtaWhatsAppBlock config={el} theme={theme as any} />;
        else if (el.type === "cta_price") content = <CtaPriceBlock config={el} theme={theme as any} />;
        else if (el.type === "authority") content = <AuthorityBlock config={el} theme={theme as any} />;
        else if (el.type === "before_after") content = <BeforeAfterBlock config={el} theme={theme as any} />;
        else if (el.type === "comparison_table") content = <ComparisonTableBlock config={el} theme={theme as any} />;
        else if (el.type === "gauge_chart") content = <GaugeChartBlock config={el} theme={theme as any} />;
        else if (el.type === "progressive_reveal") content = <ProgressiveRevealBlock config={el} theme={theme as any} />;
        else if (el.type === "roi_calculator") content = <RoiCalculatorBlock config={el} theme={theme as any} />;
        else if (el.type === "maturity_thermometer") content = <MaturityThermometerBlock config={el} theme={theme as any} />;
        else if (el.type === "pricing_plans") content = <PricingPlansBlock config={el} theme={theme as any} />;
        else if (el.type === "post_result_form") content = <PostResultFormBlock config={el} theme={theme as any} />;
        else if (el.type === "alert") content = <AlertBlock config={el} theme={theme as any} />;
        else if (el.type === "arguments") content = <ArgumentsBlock config={el} theme={theme as any} />;
        else if (el.type === "audio") content = <AudioBlock config={el} theme={theme as any} />;
        else if (el.type === "video") content = <VideoBlock config={el} theme={theme as any} />;
        else if (el.type === "spacer") content = <SpacerBlock config={el} theme={theme as any} />;
        else if (el.type === "html") content = <HtmlBlock config={el} theme={theme as any} />;
        else if (el.type === "fake_loading") content = <FakeLoadingBlock config={el} theme={theme as any} onNext={onNext} />;
        else if (el.type === "circular_progress") content = <CircularProgressBlock config={el} theme={theme as any} onNext={onNext} />;
        else if (el.type === "highlight_text") content = <HighlightTextBlock config={el} theme={theme as any} />;
        else if (el.type === "impact_summary") content = <ImpactSummaryBlock config={el} theme={theme as any} />;
        else if (el.type === "infinite_marquee") content = <InfiniteMarqueeBlock config={el} theme={theme as any} />;
        else if (el.type === "scroll_to_offer") content = <ScrollToOfferBlock config={el} theme={theme as any} onNext={onNext} />;
        else if (el.type === "icon_info") content = <IconInfoBlock config={el} theme={theme as any} />;
        else if (el.type === "faq") content = <FaqBlock config={el} theme={theme as any} />;

        if (!content) return null;

        const delay = (el as any).delay_seconds || 0;
        return (
          <Suspense key={el.id} fallback={<div className="h-4 animate-pulse bg-white/5 rounded" />}>
            <DelayedElement delay={delay}>
              {content}
            </DelayedElement>
          </Suspense>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from "react";

function DelayedElement({ children, delay }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(!delay || delay <= 0);

  useEffect(() => {
    if (!delay || delay <= 0) return;
    const t = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;
  return <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">{children}</div>;
}
