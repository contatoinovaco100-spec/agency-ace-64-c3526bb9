import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { mergeTheme, useGoogleFont, buttonRadius, type QuizTheme } from "@/lib/quizTheme";
import { renderVisualElements, type VisualElement } from "@/components/quiz/VisualElementRenderer";

// Inline SVG icons to avoid importing lucide-react bundle eagerly
const SpinnerIcon = () => <svg className="h-10 w-10 animate-spin mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
const CheckIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const WarnIcon = () => <svg className="h-12 w-12 mx-auto mb-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const UsersIcon = () => <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const LockIcon = () => <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;

// Lazy load heavy sales blocks
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
const ToastSocialOverlay = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ToastSocialOverlay })));
const ExitIntentPopup = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ExitIntentPopup })));
const ProgressiveRevealBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.ProgressiveRevealBlock })));
const RoiCalculatorBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.RoiCalculatorBlock })));
const MaturityThermometerBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.MaturityThermometerBlock })));
const PricingPlansBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.PricingPlansBlock })));
const PostResultFormBlock = lazy(() => import("@/components/quiz/SalesBlocks").then(m => ({ default: m.PostResultFormBlock })));

interface Quiz {
  id: string; name: string; description: string; status: string;
  result_title: string; result_text: string; result_cta_label: string; result_cta_url: string;
  result_image_url?: string; redirect_url?: string; redirect_delay_seconds?: number;
  progress_bar?: boolean; show_question_numbers?: boolean;
  button_label?: string; button_final_label?: string;
  theme?: any;
}
interface Question {
  id: string; type: string; title: string; description: string;
  required: boolean; order_index: number; config: any; image_url?: string;
  options: { id: string; text: string; image_url?: string }[];
}
type AnswerVal = { option_ids: string[]; text_answer: string };

const STORAGE = (k: string) => `quiz_progress_${k}`;

export default function PublicQuizPage() {
  const { clientSlug, quizSlug } = useParams<{ clientSlug: string; quizSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerVal>>({});
  const [lead, setLead] = useState({ name: "", email: "", phone: "", cnpj: "", company_name: "" });
  const [leadError, setLeadError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [animDir, setAnimDir] = useState<"in" | "out">("in");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [exitShown, setExitShown] = useState(false);

  const theme: QuizTheme = useMemo(() => mergeTheme(quiz?.theme), [quiz?.theme]);
  useGoogleFont(theme.font_family, [theme.body_weight, theme.heading_weight]);

  const utm = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") ?? "",
      utm_medium: p.get("utm_medium") ?? "",
      utm_campaign: p.get("utm_campaign") ?? "",
    };
  }, []);

  useEffect(() => { load(); }, [clientSlug, quizSlug]);

  const load = async () => {
    if (!clientSlug || !quizSlug) return;
    setLoading(true); setError(null);

    try {
      // Step 1: Get client
      const { data: client } = await supabase
        .from("quiz_clients").select("id").eq("slug", clientSlug).maybeSingle();
      
      if (!client) throw new Error("Quiz indisponível.");

      // Step 2: Get quiz
      const { data: q } = await supabase
        .from("quizzes").select("*").eq("client_id", client.id).eq("slug", quizSlug).maybeSingle();
      
      if (!q) throw new Error("Quiz indisponível.");
      if (q.status !== "active") throw new Error("Este quiz não está aceitando respostas no momento.");

      // Step 3: Get questions and options
      const { data: qs } = await supabase
        .from("quiz_questions").select("*").eq("quiz_id", q.id).order("order_index");
      
      const qIds = (qs ?? []).map(x => x.id);
      const { data: opts } = qIds.length
        ? await supabase.from("quiz_options").select("*").in("question_id", qIds).order("order_index")
        : { data: [] };

      const optsByQ = new Map<string, any[]>();
      (opts ?? []).forEach(o => {
        if (!optsByQ.has(o.question_id)) optsByQ.set(o.question_id, []);
        optsByQ.get(o.question_id)!.push(o);
      });

      setQuiz(q as any);
      setQuestions((qs ?? []).map(x => ({
        id: x.id, type: x.type, title: x.title, description: x.description,
        required: x.required, order_index: x.order_index, config: x.config,
        image_url: (x as any).image_url ?? "",
        options: (optsByQ.get(x.id) ?? []).map(o => ({
          id: o.id, text: o.text, image_url: (o as any).image_url ?? "",
        })),
      })));

      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE(`${clientSlug}_${quizSlug}`)) ?? "null");
        if (saved) {
          setAnswers(saved.answers ?? {});
          setLead({ name: "", email: "", phone: "", cnpj: "", company_name: "", ...(saved.lead ?? {}) });
          setStep(saved.step ?? 0);
        }
      } catch {}

      supabase.rpc("increment_quiz_counter", { _quiz_id: q.id, _field: "views_count" }).then(() => {});
      setLoading(false);
      ensureStartedRef.current = q.id;

    } catch (err: any) {
      setError(err.message || "Erro ao carregar quiz.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientSlug || !quizSlug || done) return;
    localStorage.setItem(STORAGE(`${clientSlug}_${quizSlug}`), JSON.stringify({ answers, lead, step }));
  }, [answers, lead, step, done, clientSlug, quizSlug]);

  const ensureStartedRef = { current: "" };

  const ensureStarted = async () => {
    if (responseId || !quiz) return responseId;
    const { data, error } = await supabase.from("quiz_responses").insert({
      quiz_id: quiz.id, ...utm,
    }).select("id").single();
    if (error) return null;
    setResponseId(data.id);
    await supabase.rpc("increment_quiz_counter", { _quiz_id: quiz.id, _field: "starts_count" });
    return data.id;
  };

  // Auto-start the response as soon as quiz loads
  useEffect(() => {
    if (quiz && !responseId && !done) {
      ensureStarted();
    }
  }, [quiz]);

  const setAnswer = (qid: string, patch: Partial<AnswerVal>) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: { option_ids: [], text_answer: "", ...prev[qid], ...patch },
    }));
  };

  const goNext = useCallback(async () => {
    const q = questions[step];
    if (q?.required) {
      const a = answers[q.id];
      if (q.type === "single" || q.type === "multiple") {
        if (!a?.option_ids?.length) return;
      } else if (q.type === "text") {
        if (!a?.text_answer?.trim()) return;
      } else if (q.type === "lead") {
        const f = (q.config?.fields ?? {}) as Record<string, boolean>;
        if (f.name && !lead.name.trim()) { setLeadError("Preencha seu nome."); return; }
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) { setLeadError("E-mail inválido."); return; }
        if (f.phone && lead.phone.replace(/\D/g, "").length < 10) { setLeadError("Telefone inválido."); return; }
        if (f.cnpj && lead.cnpj.replace(/\D/g, "").length < 14) { setLeadError("CNPJ inválido."); return; }
        if (f.company_name && !lead.company_name.trim()) { setLeadError("Preencha a Razão Social."); return; }
      }
    }
    setLeadError(null);
    if (step < questions.length - 1) {
      setAnimDir("in");
      setStep(step + 1);
    } else {
      await finish();
    }
  }, [step, questions, answers, lead]);

  const finish = async () => {
    if (!quiz) return;
    setSubmitting(true);
    const rid = await ensureStarted();
    if (!rid) { setSubmitting(false); return; }
    await supabase.from("quiz_responses").update({
      completed_at: new Date().toISOString(),
      lead_name: lead.name, lead_email: lead.email, lead_phone: lead.phone,
    }).eq("id", rid);
    
    const rows = Object.entries(answers).map(([qid, a]) => ({
      response_id: rid, question_id: qid,
      option_ids: a.option_ids ?? [], text_answer: a.text_answer ?? "",
    }));
    
    // Save CNPJ and Company Name inside quiz_answers if they exist
    const leadQuestion = questions.find(q => q.type === "lead");
    if (leadQuestion && (lead.cnpj || lead.company_name)) {
      rows.push({
        response_id: rid, question_id: leadQuestion.id,
        option_ids: [],
        text_answer: `CNPJ: ${lead.cnpj || "Não informado"} | Empresa: ${lead.company_name || "Não informada"}`
      });
    }

    if (rows.length) await supabase.from("quiz_answers").insert(rows);
    await supabase.rpc("increment_quiz_counter", { _quiz_id: quiz.id, _field: "completions_count" });
    localStorage.removeItem(STORAGE(`${clientSlug}_${quizSlug}`));
    setShowConfetti(true);
    setDone(true); setSubmitting(false);
    if (quiz.redirect_url) {
      const delay = (quiz.redirect_delay_seconds ?? 0) * 1000;
      setTimeout(() => { window.location.href = quiz.redirect_url!; }, delay);
    }
  };

  const handleOptionClick = (q: Question, optionId: string) => {
    if (q.type === "single") {
      setAnswer(q.id, { option_ids: [optionId] });
    } else {
      const a = answers[q.id] ?? { option_ids: [], text_answer: "" };
      const checked = a.option_ids.includes(optionId);
      const ids = checked ? a.option_ids.filter(x => x !== optionId) : [...a.option_ids, optionId];
      setAnswer(q.id, { option_ids: ids });
    }
  };

  // Fake social proof counter
  const [socialCount] = useState(() => Math.floor(Math.random() * 80) + 120);

  // Styles
  const pageStyle: React.CSSProperties = {
    backgroundColor: theme.background_color,
    color: theme.text_color,
    fontFamily: `'${theme.font_family}', system-ui, sans-serif`,
    fontWeight: theme.body_weight,
    backgroundImage: theme.background_image_url ? `url(${theme.background_image_url})` : undefined,
    backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed",
    minHeight: "100vh",
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.card_background,
    borderRadius: theme.border_radius,
    boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  };
  const headingStyle: React.CSSProperties = { fontWeight: theme.heading_weight, color: theme.text_color };
  const btnRadius = buttonRadius(theme.button_style, theme.border_radius);
  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: theme.primary_color, color: theme.button_text_color,
    borderRadius: btnRadius, fontWeight: 600,
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0a0a]">
        <div className="text-center">
          <SpinnerIcon />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle} className="grid place-items-center p-6">
        <div className="text-center max-w-md">
          <WarnIcon />
          <h1 className="text-xl" style={headingStyle}>{error}</h1>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  // DONE SCREEN with confetti
  if (done) {
    return (
      <div style={pageStyle} className="grid place-items-center p-6 relative overflow-hidden">
        {showConfetti && <ConfettiEffect color={theme.primary_color} />}
        <div style={cardStyle} className="max-w-md w-full text-center p-8 relative z-10">
          {quiz.result_image_url ? (
            <img src={quiz.result_image_url} alt="" className="w-full mb-4" style={{ borderRadius: theme.border_radius }} />
          ) : (
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-2"
                style={{ backgroundColor: `${theme.primary_color}20` }}>
                <CheckIcon className="h-10 w-10" style={{ color: theme.primary_color }} />
              </div>
            </div>
          )}
          <h1 className="text-2xl mb-2" style={headingStyle}>{quiz.result_title}</h1>
          <p className="opacity-80 whitespace-pre-line">{quiz.result_text}</p>
          {quiz.result_cta_label && quiz.result_cta_url && (
            <a href={quiz.result_cta_url} target="_blank" rel="noreferrer"
              className="inline-block mt-5 px-8 py-4 w-full text-center text-lg font-semibold transition-transform hover:scale-[1.02] active:scale-95"
              style={primaryBtnStyle}>
              {quiz.result_cta_label}
            </a>
          )}
          {quiz.redirect_url && (
            <p className="text-xs opacity-60 mt-4 animate-pulse">Redirecionando…</p>
          )}
        </div>
      </div>
    );
  }



  const q = questions[step];
  const progress = questions.length ? ((step + 1) / questions.length) * 100 : 0;
  const a = answers[q?.id ?? ""] ?? { option_ids: [], text_answer: "" };
  const showProgress = quiz.progress_bar !== false;
  const textAlign = (q?.config?.text_align ?? "center") as "left" | "center" | "right";
  const alignClass = textAlign === "left" ? "text-left" : textAlign === "right" ? "text-right" : "text-center";
  const visualElements: VisualElement[] = Array.isArray(q?.config?.elements) ? q.config.elements : [];
  const visualPosition = q?.config?.visual_position ?? "top";

  return (
    <div style={pageStyle}>
      <style>{`
        .quiz-input:focus { 
          border-color: ${theme.primary_color} !important;
          box-shadow: 0 0 0 1px ${theme.primary_color} !important;
          outline: none !important;
        }
      `}</style>
      <div className="max-w-xl mx-auto p-6 sm:p-10">
        <header className="mb-6 text-center">
          {theme.show_logo && theme.logo_url && (
            <img src={theme.logo_url} alt="" className="h-10 mx-auto mb-3 object-contain" height="40" width="auto" loading="eager" />
          )}
        </header>

        {showProgress && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium opacity-60">{step + 1} de {questions.length}</span>
              <span className="text-xs font-medium opacity-60">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: theme.primary_color }} />
            </div>
          </div>
        )}

        {!q ? (
          <div className="text-center opacity-60">Sem perguntas neste quiz.</div>
        ) : (
          <div
            key={q.id}
            style={{
              ...cardStyle,
              animation: "quizSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)",
            }}
            className="p-6 sm:p-8 space-y-5"
          >
            {q.image_url && (
              <img src={q.image_url} alt="" className="w-full" style={{ borderRadius: theme.border_radius }} loading="eager" />
            )}
            {(q.title || q.description) && (
              <div className={alignClass}>
                {q.title && (
                  <h2 className="text-2xl leading-tight" style={headingStyle}>
                    {q.title}
                    {q.required && <span style={{ color: theme.primary_color }}> *</span>}
                  </h2>
                )}
                {q.description && <p className="text-sm opacity-70 mt-2 whitespace-pre-line">{q.description}</p>}
              </div>
            )}

            {q.type !== "visual" && q.config?.image_url && (
              <img src={q.config.image_url} alt="" className="w-full mb-6" style={{ borderRadius: theme.border_radius }} />
            )}

            {visualElements.length > 0 && visualPosition === "top" && (
              <div className="space-y-4 mb-6">
                {renderVisualElements(visualElements, theme, () => goNext())}
              </div>
            )}

            {(q.type === "single" || q.type === "multiple") && (
              <div className="space-y-3">
                {q.options.map((o, idx) => {
                  const checked = a.option_ids.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => handleOptionClick(q, o.id)}
                      className="w-full text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        borderRadius: theme.border_radius,
                        border: `2px solid ${checked ? theme.primary_color : "rgba(128,128,128,0.25)"}`,
                        backgroundColor: checked ? `${theme.primary_color}15` : "rgba(128,128,128,0.05)",
                        color: theme.text_color,
                        padding: o.image_url ? "0" : undefined,
                        overflow: "hidden",
                      }}
                    >
                      {o.image_url && (
                        <img src={o.image_url} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} loading="lazy" />
                      )}
                      <div className="flex items-center gap-4 p-5">
                        <div
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                          style={{
                            backgroundColor: checked ? theme.primary_color : "rgba(128,128,128,0.1)",
                            color: checked ? theme.button_text_color : theme.text_color,
                            border: `2px solid ${checked ? theme.primary_color : "rgba(128,128,128,0.3)"}`,
                          }}
                        >
                          {checked ? "✓" : String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-base font-medium flex-1">{o.text}</span>
                        {checked && (
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: theme.primary_color }}>
                            <CheckIcon className="h-4 w-4" style={{ color: theme.button_text_color }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Always show CTA button — user must click to advance */}
                <button
                  onClick={() => goNext()}
                  disabled={!a.option_ids.length}
                  className="w-full py-4 text-base font-bold mt-4 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    ...primaryBtnStyle,
                    boxShadow: a.option_ids.length ? `0 4px 20px ${theme.primary_color}40` : "none",
                  }}
                >
                  {submitting && <svg className="h-5 w-5 mr-2 animate-spin inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>}
                  {step === questions.length - 1 ? `${quiz.button_final_label || "Ver meu resultado"} →` : `${quiz.button_label || "Continuar"} →`}
                </button>
              </div>
            )}

            {q.type === "text" && (
              <div className="space-y-4">
                <textarea rows={4} value={a.text_answer}
                  onChange={e => setAnswer(q.id, { text_answer: e.target.value })}
                  placeholder="Digite sua resposta aqui..."
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, fontSize: "1rem", padding: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                  className="quiz-input" />
                <button
                  onClick={() => goNext()}
                  disabled={q.required && !a.text_answer?.trim()}
                  className="w-full py-4 text-base font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    ...primaryBtnStyle,
                    boxShadow: a.text_answer?.trim() ? `0 4px 20px ${theme.primary_color}40` : "none",
                  }}
                >
                  {step === questions.length - 1 ? `${quiz.button_final_label || "Ver meu resultado"} →` : `${quiz.button_label || "Continuar"} →`}
                </button>
              </div>
            )}

            {q.type === "lead" && (
              <div className="space-y-4">
                {q.config?.fields?.name && (
                  <div>
                    <label className="opacity-80 text-sm mb-1 block">{q.config?.labels?.name || "Seu nome"}</label>
                    <input value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })}
                      placeholder={q.config?.labels?.name || "Digite seu nome completo"}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, padding: "1rem", height: "auto", fontSize: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                      className="quiz-input transition-all" />
                  </div>
                )}
                {q.config?.fields?.email && (
                  <div>
                    <label className="opacity-80 text-sm mb-1 block">{q.config?.labels?.email || "Seu e-mail"}</label>
                    <input type="email" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })}
                      placeholder="seu@email.com"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, padding: "1rem", height: "auto", fontSize: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                      className="quiz-input transition-all" />
                  </div>
                )}
                {q.config?.fields?.phone && (
                  <div>
                    <label className="opacity-80 text-sm mb-1 block">{q.config?.labels?.phone || "Seu telefone"}</label>
                    <input value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, padding: "1rem", height: "auto", fontSize: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                      className="quiz-input transition-all" />
                  </div>
                )}
                {q.config?.fields?.cnpj && (
                  <div>
                    <label className="opacity-80 text-sm mb-1 block">{q.config?.labels?.cnpj || "Seu CNPJ"}</label>
                    <input value={lead.cnpj} onChange={e => setLead({ ...lead, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, padding: "1rem", height: "auto", fontSize: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                      className="quiz-input transition-all" />
                  </div>
                )}
                {q.config?.fields?.company_name && (
                  <div>
                    <label className="opacity-80 text-sm mb-1 block">{q.config?.labels?.company_name || "Razão Social"}</label>
                    <input value={lead.company_name} onChange={e => setLead({ ...lead, company_name: e.target.value })}
                      placeholder="Nome da sua empresa"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius, padding: "1rem", height: "auto", fontSize: "1rem", width: "100%", border: "1px solid rgba(255,255,255,0.2)", outline: "none" }}
                      className="quiz-input transition-all" />
                  </div>
                )}
                <button
                  onClick={() => goNext()}
                  disabled={submitting}
                  className="w-full py-4 text-base font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                  style={{
                    ...primaryBtnStyle,
                    boxShadow: `0 4px 20px ${theme.primary_color}40`,
                  }}
                >
                  {submitting && <svg className="h-5 w-5 mr-2 animate-spin inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>}
                  {step === questions.length - 1 ? `${quiz.button_final_label || "Ver meu resultado"} →` : `${quiz.button_label || "Continuar"} →`}
                </button>
                {leadError && (
                  <div className="text-center text-sm font-semibold text-red-500 bg-red-500/10 py-2 px-3 rounded-md animate-in slide-in-from-bottom-2">
                    {leadError}
                  </div>
                )}
                <p className="text-center text-xs opacity-40 flex items-center justify-center gap-1">
                  <LockIcon /> Seus dados estão protegidos
                </p>
              </div>
            )}

            {visualElements.length > 0 && visualPosition === "bottom" && (
              <div className="space-y-4 mt-6 pt-6 border-t border-white/10">
                {renderVisualElements(visualElements, theme, () => goNext())}
              </div>
            )}

            {/* Sales blocks rendering */}
            <Suspense fallback={<div className="h-20 flex items-center justify-center"><svg className="h-6 w-6 animate-spin opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg></div>}>
              {q.type === "scarcity" && <ScarcityBlock config={q.config} theme={theme} />}
              {q.type === "social_proof" && <SocialProofBlock config={q.config} theme={theme} />}
              {q.type === "testimonials" && <TestimonialsBlock config={q.config} theme={theme} />}
              {q.type === "cta_whatsapp" && <CtaWhatsAppBlock config={q.config} theme={theme} />}
              {q.type === "cta_price" && <CtaPriceBlock config={q.config} theme={theme} />}
              {q.type === "authority" && <AuthorityBlock config={q.config} theme={theme} />}
              {q.type === "before_after" && <BeforeAfterBlock config={q.config} theme={theme} />}
              {q.type === "comparison_table" && <ComparisonTableBlock config={q.config} theme={theme} />}
              {q.type === "gauge_chart" && <GaugeChartBlock config={q.config} theme={theme} />}
              {q.type === "progressive_reveal" && <ProgressiveRevealBlock config={q.config} theme={theme} />}
              {q.type === "roi_calculator" && <RoiCalculatorBlock config={q.config} theme={theme} />}
              {q.type === "maturity_thermometer" && <MaturityThermometerBlock config={q.config} theme={theme} />}
              {q.type === "pricing_plans" && <PricingPlansBlock config={q.config} theme={theme} />}
              {q.type === "post_result_form" && <PostResultFormBlock config={q.config} theme={theme} />}

              {/* Motivational progress bar block */}
              {q.type === "progress_motivational" && (
                <ProgressMotivationalBlock config={q.config} theme={theme} progress={progress} />
              )}
            </Suspense>

            {/* Continue button for legacy sales blocks */}
            {["scarcity","social_proof","testimonials","authority","before_after","comparison_table","gauge_chart","progress_motivational","progressive_reveal","roi_calculator","maturity_thermometer"].includes(q.type) && (
              <button
                onClick={() => goNext()}
                className="w-full py-4 text-base font-bold transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  ...primaryBtnStyle,
                  boxShadow: `0 4px 20px ${theme.primary_color}40`,
                }}
              >
                {step === questions.length - 1 ? `${quiz.button_final_label || "Ver meu resultado"} →` : `${quiz.button_label || "Continuar"} →`}
              </button>
            )}
          </div>
        )}

        {/* Toast social overlay */}
        {(() => {
          const toastQ = questions.find(qq => qq.type === "toast_social");
          return toastQ ? <ToastSocialOverlay config={toastQ.config} theme={theme} active={!done} /> : null;
        })()}

        {/* Exit intent popup */}
        {(() => {
          const exitQ = questions.find(qq => qq.type === "exit_intent");
          if (!exitQ || exitShown) return null;
          const handleExit = () => {
            setShowExitPopup(true);
            setExitShown(true);
          };
          // Desktop: mouseleave at top
          if (typeof window !== "undefined" && !showExitPopup && !exitShown) {
            const onLeave = (e: MouseEvent) => { if (e.clientY < 5) handleExit(); };
            document.addEventListener("mouseout", onLeave, { once: true });
          }
          return showExitPopup ? (
            <ExitIntentPopup config={exitQ.config} theme={theme} onClose={() => setShowExitPopup(false)} />
          ) : null;
        })()}

        {/* Social proof footer on question screens */}
        {step >= 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs opacity-50">
            <UsersIcon />
            <span>{socialCount} pessoas responderam hoje</span>
          </div>
        )}

        <p className="text-center text-xs opacity-40 mt-4">Powered by INOVA</p>
      </div>

      <style>{`
        @keyframes quizSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          animation: confettiFall linear forwards;
        }
      `}</style>
    </div>
  );
}

function ConfettiEffect({ color }: { color: string }) {
  const pieces = useMemo(() => {
    const colors = [color, "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b"];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`,
      size: `${6 + Math.random() * 8}px`,
      shape: Math.random() > 0.5 ? "50%" : "0",
    }));
  }, [color]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
          }}
        />
      ))}
    </div>
  );
}
