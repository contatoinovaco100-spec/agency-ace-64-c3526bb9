import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { mergeTheme, useGoogleFont, buttonRadius, type QuizTheme } from "@/lib/quizTheme";
import { renderVisualElements, type VisualElement } from "@/components/quiz/VisualSectionEditor";

interface Quiz {
  id: string; name: string; description: string; status: string;
  result_title: string; result_text: string; result_cta_label: string; result_cta_url: string;
  result_image_url?: string; redirect_url?: string; redirect_delay_seconds?: number;
  progress_bar?: boolean; show_question_numbers?: boolean;
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
  const [lead, setLead] = useState({ name: "", email: "", phone: "" });
  const [responseId, setResponseId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    const { data: client } = await supabase
      .from("quiz_clients").select("id").eq("slug", clientSlug).maybeSingle();
    if (!client) { setError("Quiz indisponível."); setLoading(false); return; }
    const { data: q } = await supabase
      .from("quizzes").select("*").eq("client_id", client.id).eq("slug", quizSlug).maybeSingle();
    if (!q) { setError("Quiz indisponível."); setLoading(false); return; }
    if (q.status !== "active") { setError("Este quiz não está aceitando respostas no momento."); setLoading(false); return; }
    const { data: qs } = await supabase
      .from("quiz_questions").select("*").eq("quiz_id", q.id).order("order_index");
    const ids = (qs ?? []).map(x => x.id);
    const { data: opts } = ids.length
      ? await supabase.from("quiz_options").select("*").in("question_id", ids).order("order_index")
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
        setLead(saved.lead ?? { name: "", email: "", phone: "" });
        setStep(saved.step ?? 0);
      }
    } catch {}
    await supabase.rpc("increment_quiz_counter", { _quiz_id: q.id, _field: "views_count" });
    setLoading(false);
  };

  useEffect(() => {
    if (!clientSlug || !quizSlug || done) return;
    localStorage.setItem(STORAGE(`${clientSlug}_${quizSlug}`), JSON.stringify({ answers, lead, step }));
  }, [answers, lead, step, done, clientSlug, quizSlug]);

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

  const setAnswer = (qid: string, patch: Partial<AnswerVal>) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: { option_ids: [], text_answer: "", ...prev[qid], ...patch },
    }));
  };

  const next = async () => {
    if (step === 0) await ensureStarted();
    const q = questions[step];
    if (q?.required) {
      const a = answers[q.id];
      if (q.type === "single" || q.type === "multiple") {
        if (!a?.option_ids?.length) return alert("Selecione uma opção");
      } else if (q.type === "text") {
        if (!a?.text_answer?.trim()) return alert("Preencha a resposta");
      } else if (q.type === "lead") {
        const f = (q.config?.fields ?? {}) as Record<string, boolean>;
        if (f.name && !lead.name.trim()) return alert("Informe seu nome");
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return alert("E-mail inválido");
        if (f.phone && lead.phone.replace(/\D/g, "").length < 10) return alert("Telefone inválido");
      }
    }
    if (step < questions.length - 1) setStep(step + 1);
    else await finish();
  };

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
    if (rows.length) await supabase.from("quiz_answers").insert(rows);
    await supabase.rpc("increment_quiz_counter", { _quiz_id: quiz.id, _field: "completions_count" });
    localStorage.removeItem(STORAGE(`${clientSlug}_${quizSlug}`));
    setDone(true); setSubmitting(false);

    // Redirect after delay
    if (quiz.redirect_url) {
      const delay = (quiz.redirect_delay_seconds ?? 0) * 1000;
      setTimeout(() => { window.location.href = quiz.redirect_url!; }, delay);
    }
  };

  // Theme-derived styles
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
  const optionBaseStyle = (selected: boolean): React.CSSProperties => ({
    borderRadius: theme.border_radius,
    border: `2px solid ${selected ? theme.primary_color : "rgba(255,255,255,0.12)"}`,
    backgroundColor: selected ? theme.primary_color : "transparent",
    color: selected ? theme.button_text_color : theme.text_color,
    transition: "all 0.15s",
  });

  if (loading) {
    return <div style={pageStyle} className="grid place-items-center"><Loader2 className="h-8 w-8 animate-spin opacity-60" /></div>;
  }
  if (error) {
    return (
      <div style={pageStyle} className="grid place-items-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-500" />
          <h1 className="text-xl" style={headingStyle}>{error}</h1>
        </div>
      </div>
    );
  }
  if (!quiz) return null;

  if (done) {
    return (
      <div style={pageStyle} className="grid place-items-center p-6">
        <div style={cardStyle} className="max-w-md w-full text-center p-8">
          {quiz.result_image_url ? (
            <img src={quiz.result_image_url} alt="" className="w-full mb-4" style={{ borderRadius: theme.border_radius }} />
          ) : (
            <CheckCircle2 className="h-14 w-14 mx-auto mb-3" style={{ color: theme.primary_color }} />
          )}
          <h1 className="text-2xl mb-2" style={headingStyle}>{quiz.result_title}</h1>
          <p className="opacity-80 whitespace-pre-line">{quiz.result_text}</p>
          {quiz.result_cta_label && quiz.result_cta_url && (
            <a href={quiz.result_cta_url} target="_blank" rel="noreferrer"
              className="inline-block mt-5 px-6 py-3" style={primaryBtnStyle}>
              {quiz.result_cta_label}
            </a>
          )}
          {quiz.redirect_url && (
            <p className="text-xs opacity-60 mt-4">Redirecionando…</p>
          )}
        </div>
      </div>
    );
  }

  const q = questions[step];
  const progress = questions.length ? ((step + 1) / questions.length) * 100 : 0;
  const a = answers[q?.id ?? ""] ?? { option_ids: [], text_answer: "" };
  const showProgress = quiz.progress_bar !== false;
  const showNumbers = quiz.show_question_numbers !== false;

  return (
    <div style={pageStyle}>
      <div className="max-w-xl mx-auto p-6 sm:p-10">
        <header className="mb-6 text-center">
          {theme.show_logo && theme.logo_url && (
            <img src={theme.logo_url} alt="" className="h-12 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-lg" style={headingStyle}>{quiz.name}</h1>
          {quiz.description && <p className="text-sm opacity-70 mt-1">{quiz.description}</p>}
        </header>

        {showProgress && (
          <div className="h-1.5 w-full rounded-full mb-6 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: theme.primary_color }} />
          </div>
        )}

        {!q ? (
          <div className="text-center opacity-60">Sem perguntas neste quiz.</div>
        ) : (
          <div style={cardStyle} className="p-6 space-y-4 animate-in fade-in">
            {q.image_url && (
              <img src={q.image_url} alt="" className="w-full" style={{ borderRadius: theme.border_radius }} />
            )}
            <div>
              <h2 className="text-xl" style={headingStyle}>
                {showNumbers && <span className="opacity-50 mr-2">{step + 1}.</span>}
                {q.title}
                {q.required && <span style={{ color: theme.primary_color }}>*</span>}
              </h2>
              {q.description && <p className="text-sm opacity-70 mt-1 whitespace-pre-line">{q.description}</p>}
            </div>

            {q.type === "visual" && q.config?.image_url && (
              <img src={q.config.image_url} alt="" className="w-full" style={{ borderRadius: theme.border_radius }} />
            )}

            {(q.type === "single" || q.type === "multiple") && (
              <div className={q.options.some(o => o.image_url) ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {q.options.map(o => {
                  const checked = a.option_ids.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        if (q.type === "single") setAnswer(q.id, { option_ids: [o.id] });
                        else {
                          const ids = checked ? a.option_ids.filter(x => x !== o.id) : [...a.option_ids, o.id];
                          setAnswer(q.id, { option_ids: ids });
                        }
                      }}
                      className="text-left p-3 transition w-full"
                      style={optionBaseStyle(checked)}
                    >
                      {o.image_url && (
                        <img src={o.image_url} alt="" className="w-full mb-2" style={{ borderRadius: theme.border_radius / 2 }} />
                      )}
                      <span className="block">{o.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "text" && (
              <Textarea rows={4} value={a.text_answer}
                onChange={e => setAnswer(q.id, { text_answer: e.target.value })}
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius }}
                className="border-white/20" />
            )}

            {q.type === "lead" && (
              <div className="space-y-3">
                {q.config?.fields?.name && (
                  <div><Label className="opacity-80">Nome</Label>
                    <Input value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius }}
                      className="border-white/20" /></div>
                )}
                {q.config?.fields?.email && (
                  <div><Label className="opacity-80">E-mail</Label>
                    <Input type="email" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius }}
                      className="border-white/20" /></div>
                )}
                {q.config?.fields?.phone && (
                  <div><Label className="opacity-80">Telefone</Label>
                    <Input value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.text_color, borderRadius: theme.border_radius }}
                      className="border-white/20" /></div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                style={{ color: theme.text_color, opacity: step === 0 ? 0.3 : 0.8 }}>
                Voltar
              </Button>
              <button onClick={next} disabled={submitting}
                className="inline-flex items-center px-6 py-2.5 disabled:opacity-60"
                style={primaryBtnStyle}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {step === questions.length - 1 ? "Finalizar" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs opacity-40 mt-6">Powered by INOVA</p>
      </div>
    </div>
  );
}
