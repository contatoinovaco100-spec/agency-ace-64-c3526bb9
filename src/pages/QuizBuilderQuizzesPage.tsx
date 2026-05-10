import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Loader2, ArrowLeft, Pencil, Copy, Eye, Trash2, Pause, Play,
  CheckCircle2, XCircle, Files, BarChart3, ExternalLink,
} from "lucide-react";
import { isQuizSlugAvailable, isValidSlug, slugify } from "@/lib/quizSlug";

interface QuizRow {
  id: string; client_id: string; name: string; slug: string;
  description: string; status: "draft" | "active" | "paused";
  views_count: number; starts_count: number; completions_count: number;
  created_at: string;
}
interface ClientLite { id: string; name: string; slug: string; }

export default function QuizBuilderQuizzesPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientLite | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isAdmin && clientId) load(); }, [isAdmin, clientId]);

  useEffect(() => { if (open && !slugTouched) setSlug(slugify(name)); }, [name, open, slugTouched]);

  useEffect(() => {
    if (!open || !slug || !clientId) { setSlugAvailable(null); return; }
    if (!isValidSlug(slug)) { setSlugAvailable(false); return; }
    let cancel = false;
    setSlugChecking(true);
    const t = setTimeout(async () => {
      const ok = await isQuizSlugAvailable(clientId, slug);
      if (!cancel) { setSlugAvailable(ok); setSlugChecking(false); }
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [slug, open, clientId]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [{ data: c }, { data: qs }] = await Promise.all([
      supabase.from("quiz_clients").select("id, name, slug").eq("id", clientId).maybeSingle(),
      supabase.from("quizzes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setClient(c);
    setQuizzes((qs ?? []) as QuizRow[]);
    if (qs && qs.length) {
      const { data: resps } = await supabase
        .from("quiz_responses").select("quiz_id").in("quiz_id", qs.map(q => q.id));
      const m = new Map<string, number>();
      (resps ?? []).forEach(r => m.set(r.quiz_id, (m.get(r.quiz_id) ?? 0) + 1));
      setResponseCounts(m);
    }
    setLoading(false);
  };

  const openNew = () => {
    setName(""); setSlug(""); setSlugTouched(false); setDescription(""); setOpen(true);
  };

  const create = async () => {
    if (!clientId) return;
    if (!name.trim() || !isValidSlug(slug) || slugAvailable === false) {
      toast({ title: "Verifique nome e slug", variant: "destructive" }); return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("quizzes").insert({
      client_id: clientId, name, slug, description, status: "draft",
    }).select("id").single();
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    navigate(`/quiz-builder/editor/${data.id}`);
  };

  const duplicate = async (q: QuizRow) => {
    const newSlug = `${q.slug}-copia-${Math.random().toString(36).slice(2, 6)}`;
    const { data: nq, error } = await supabase.from("quizzes").insert({
      client_id: q.client_id, name: `${q.name} (cópia)`, slug: newSlug,
      description: q.description, status: "draft",
    }).select("id").single();
    if (error || !nq) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }
    const { data: questions } = await supabase
      .from("quiz_questions").select("*").eq("quiz_id", q.id).order("order_index");
    if (questions?.length) {
      for (const qq of questions) {
        const { data: newQ } = await supabase.from("quiz_questions").insert({
          quiz_id: nq.id, type: qq.type, title: qq.title, description: qq.description,
          required: qq.required, order_index: qq.order_index, config: qq.config,
        }).select("id").single();
        if (newQ) {
          const { data: opts } = await supabase
            .from("quiz_options").select("*").eq("question_id", qq.id);
          if (opts?.length) {
            await supabase.from("quiz_options").insert(
              opts.map(o => ({ question_id: newQ.id, text: o.text, order_index: o.order_index }))
            );
          }
        }
      }
    }
    toast({ title: "Quiz duplicado" });
    load();
  };

  const toggleStatus = async (q: QuizRow) => {
    const next = q.status === "active" ? "paused" : "active";
    await supabase.from("quizzes").update({ status: next }).eq("id", q.id);
    load();
  };

  const remove = async (q: QuizRow) => {
    if (!confirm(`Excluir o quiz "${q.name}" e todas as suas respostas?`)) return;
    await supabase.from("quizzes").delete().eq("id", q.id);
    load();
  };

  const copyLink = (q: QuizRow) => {
    if (!client) return;
    const url = `${window.location.origin}/quiz/${client.slug}/${q.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  };

  if (roleLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quiz-builder")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client?.name ?? "Cliente"}</h1>
            <p className="text-sm text-muted-foreground font-mono">/quiz/{client?.slug}/...</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo quiz</Button>
      </div>

      {loading ? (
        <div className="p-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : quizzes.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          Nenhum quiz para este cliente ainda.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map(q => {
            const responses = responseCounts.get(q.id) ?? 0;
            return (
              <Card key={q.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{q.name}</CardTitle>
                    <Badge variant={
                      q.status === "active" ? "default" : q.status === "paused" ? "secondary" : "outline"
                    }>{q.status === "active" ? "ativo" : q.status === "paused" ? "pausado" : "rascunho"}</Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">/{q.slug}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {q.description && <p className="text-sm text-muted-foreground line-clamp-2">{q.description}</p>}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><div className="font-bold text-foreground">{q.views_count}</div><div className="text-muted-foreground">views</div></div>
                    <div><div className="font-bold text-foreground">{responses}</div><div className="text-muted-foreground">respostas</div></div>
                    <div><div className="font-bold text-foreground">{q.completions_count}</div><div className="text-muted-foreground">finalizadas</div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button size="sm" onClick={() => navigate(`/quiz-builder/editor/${q.id}`)}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/quiz-builder/respostas/${q.id}`)}>
                      <BarChart3 className="h-3 w-3 mr-1" />Respostas
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyLink(q)}>
                      <Copy className="h-3 w-3 mr-1" />Copiar link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(q)}>
                      {q.status === "active" ? <><Pause className="h-3 w-3 mr-1" />Pausar</> : <><Play className="h-3 w-3 mr-1" />Ativar</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(q)}>
                      <Files className="h-3 w-3 mr-1" />Duplicar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(q)}>
                      <Trash2 className="h-3 w-3 mr-1 text-destructive" />Excluir
                    </Button>
                  </div>
                  {client && q.status === "active" && (
                    <a
                      href={`/quiz/${client.slug}/${q.slug}`} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />Abrir página pública
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo quiz</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do quiz *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Slug</Label>
              <div className="flex gap-2 items-center">
                <Input className="font-mono" value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} />
                {slug && (slugChecking ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  slugAvailable === true ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                  slugAvailable === false ? <XCircle className="h-4 w-4 text-destructive" /> : null)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">URL: /quiz/{client?.slug}/{slug || "..."}</p>
            </div>
            <div>
              <Label>Descrição interna (não aparece no quiz)</Label>
              <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
