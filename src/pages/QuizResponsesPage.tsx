import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Download, Eye } from "lucide-react";

interface Resp {
  id: string; started_at: string; completed_at: string | null;
  lead_name: string; lead_email: string; lead_phone: string;
  utm_source: string; utm_medium: string; utm_campaign: string;
}
interface Question { id: string; title: string; type: string; }
interface OptionRow { id: string; question_id: string; text: string; }
interface Answer { id: string; response_id: string; question_id: string; option_ids: string[]; text_answer: string; }

export default function QuizResponsesPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [detail, setDetail] = useState<Resp | null>(null);

  useEffect(() => { if (isAdmin && quizId) load(); }, [isAdmin, quizId]);

  const load = async () => {
    if (!quizId) return;
    setLoading(true);
    const { data: q } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
    setQuiz(q);
    const [{ data: rs }, { data: qs }] = await Promise.all([
      supabase.from("quiz_responses").select("*").eq("quiz_id", quizId).order("started_at", { ascending: false }),
      supabase.from("quiz_questions").select("id, title, type").eq("quiz_id", quizId).order("order_index"),
    ]);
    setResponses((rs ?? []) as Resp[]);
    setQuestions((qs ?? []) as Question[]);
    const qids = (qs ?? []).map(x => x.id);
    if (qids.length) {
      const { data: opts } = await supabase.from("quiz_options").select("id, question_id, text").in("question_id", qids);
      setOptions((opts ?? []) as OptionRow[]);
    }
    const rids = (rs ?? []).map(r => r.id);
    if (rids.length) {
      const { data: ans } = await supabase.from("quiz_answers").select("*").in("response_id", rids);
      setAnswers((ans ?? []) as Answer[]);
    }
    setLoading(false);
  };

  const exportCsv = () => {
    const headers = ["data_inicio", "data_fim", "nome", "email", "telefone", "utm_source", "utm_medium", "utm_campaign",
      ...questions.map(q => q.title || `Pergunta ${q.id.slice(0, 4)}`)];
    const lines = [headers.join(",")];
    for (const r of responses) {
      const row: string[] = [
        r.started_at, r.completed_at ?? "", r.lead_name, r.lead_email, r.lead_phone,
        r.utm_source, r.utm_medium, r.utm_campaign,
      ];
      for (const q of questions) {
        const a = answers.find(x => x.response_id === r.id && x.question_id === q.id);
        const v = a
          ? (a.option_ids?.length
              ? a.option_ids.map(oid => options.find(o => o.id === oid)?.text ?? "").join(" | ")
              : a.text_answer)
          : "";
        row.push(v);
      }
      lines.push(row.map(s => `"${(s ?? "").toString().replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respostas-${quiz?.slug ?? "quiz"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (roleLoading || loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const completions = responses.filter(r => r.completed_at).length;
  const conv = responses.length ? Math.round((completions / responses.length) * 100) : 0;

  const detailAnswers = detail ? answers.filter(a => a.response_id === detail.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => quiz && navigate(`/quiz-builder/c/${quiz.client_id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">Respostas — {quiz?.name}</h1>
          <p className="text-sm text-muted-foreground">{responses.length} respostas no total</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!responses.length}>
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Visualizações", v: quiz?.views_count ?? 0 },
          { label: "Inícios", v: quiz?.starts_count ?? 0 },
          { label: "Conclusões", v: completions },
          { label: "Taxa conclusão", v: `${conv}%` },
          { label: "Leads", v: responses.filter(r => r.lead_email || r.lead_phone).length },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-bold">{s.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {responses.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhuma resposta ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">E-mail</th>
                    <th className="text-left p-3">Telefone</th>
                    <th className="text-left p-3">UTM source</th>
                    <th className="text-left p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">{new Date(r.started_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3">{r.lead_name || "—"}</td>
                      <td className="p-3">{r.lead_email || "—"}</td>
                      <td className="p-3">{r.lead_phone || "—"}</td>
                      <td className="p-3">{r.utm_source || "—"}</td>
                      <td className="p-3">
                        {r.completed_at
                          ? <Badge>Finalizada</Badge>
                          : <Badge variant="secondary">Iniciada</Badge>}
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhe da resposta</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="text-xs text-muted-foreground">
                {new Date(detail.started_at).toLocaleString("pt-BR")} · {detail.lead_name || "Anônimo"}
              </div>
              {questions.map(q => {
                const a = detailAnswers.find(x => x.question_id === q.id);
                const v = a
                  ? (a.option_ids?.length
                      ? a.option_ids.map(oid => options.find(o => o.id === oid)?.text).filter(Boolean).join(", ")
                      : a.text_answer)
                  : "—";
                return (
                  <div key={q.id} className="border rounded-md p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">{q.title}</div>
                    <div className="text-sm whitespace-pre-line">{v || "—"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
