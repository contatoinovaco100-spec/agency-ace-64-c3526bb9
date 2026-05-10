import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Layers, Plus, Search, Pencil, Trash2, Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { isClientSlugAvailable, isValidSlug, slugify } from "@/lib/quizSlug";

interface QuizClientRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  company: string;
  notes: string;
  status: string;
  quiz_count: number;
  response_count: number;
}

export default function QuizBuilderClientsPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<QuizClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [editing, setEditing] = useState<QuizClientRow | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  useEffect(() => {
    if (!open) return;
    if (!slugTouched) setSlug(slugify(name));
  }, [name, open, slugTouched]);

  useEffect(() => {
    if (!open || !slug) { setSlugAvailable(null); return; }
    if (!isValidSlug(slug)) { setSlugAvailable(false); return; }
    let cancel = false;
    setSlugChecking(true);
    const t = setTimeout(async () => {
      const ok = await isClientSlugAvailable(slug, editing?.id);
      if (!cancel) { setSlugAvailable(ok); setSlugChecking(false); }
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [slug, open, editing?.id]);

  const load = async () => {
    setLoading(true);
    const { data: clients } = await supabase
      .from("quiz_clients").select("*").order("created_at", { ascending: false });
    const { data: quizzes } = await supabase.from("quizzes").select("id, client_id");
    const quizIds = (quizzes ?? []).map(q => q.id);
    const responsesMap = new Map<string, number>();
    if (quizIds.length) {
      const { data: resps } = await supabase
        .from("quiz_responses").select("quiz_id").in("quiz_id", quizIds);
      const qToClient = new Map((quizzes ?? []).map(q => [q.id, q.client_id]));
      (resps ?? []).forEach(r => {
        const cid = qToClient.get(r.quiz_id);
        if (cid) responsesMap.set(cid, (responsesMap.get(cid) ?? 0) + 1);
      });
    }
    const quizCount = new Map<string, number>();
    (quizzes ?? []).forEach(q => quizCount.set(q.client_id, (quizCount.get(q.client_id) ?? 0) + 1));

    setRows((clients ?? []).map(c => ({
      ...c,
      quiz_count: quizCount.get(c.id) ?? 0,
      response_count: responsesMap.get(c.id) ?? 0,
    })));
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setName(""); setSlug(""); setSlugTouched(false);
    setEmail(""); setCompany(""); setNotes(""); setStatus("ativo");
    setOpen(true);
  };

  const openEdit = (row: QuizClientRow) => {
    setEditing(row);
    setName(row.name); setSlug(row.slug); setSlugTouched(true);
    setEmail(row.email); setCompany(row.company); setNotes(row.notes);
    setStatus(row.status as "ativo" | "inativo");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!isValidSlug(slug)) {
      toast({ title: "Slug inválido", description: "3-60 chars, letras minúsculas, números e hífens.", variant: "destructive" });
      return;
    }
    if (slugAvailable === false) {
      toast({ title: "Slug já em uso", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = { name, slug, email, company, notes, status };
    const { error } = editing
      ? await supabase.from("quiz_clients").update(payload).eq("id", editing.id)
      : await supabase.from("quiz_clients").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Cliente atualizado" : "Cliente criado" });
    setOpen(false); load();
  };

  const remove = async (row: QuizClientRow) => {
    if (!confirm(`Excluir ${row.name} e TODOS os seus quizzes/respostas?`)) return;
    const { error } = await supabase.from("quiz_clients").delete().eq("id", row.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente excluído" });
    load();
  };

  if (roleLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = rows.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !r.slug.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quiz Builder</h1>
            <p className="text-sm text-muted-foreground">Clientes e seus quizzes públicos</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo cliente</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou slug" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(["all", "ativo", "inativo"] as const).map(s => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "all" ? "Todos" : s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              Nenhum cliente cadastrado.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(r => (
                <div key={r.id} className="p-4 flex items-center gap-4 flex-wrap hover:bg-muted/30">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">/{r.slug}</div>
                  </div>
                  <div className="text-sm text-muted-foreground hidden sm:block">
                    {r.quiz_count} {r.quiz_count === 1 ? "quiz" : "quizzes"} · {r.response_count} respostas
                  </div>
                  <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => navigate(`/quiz-builder/c/${r.id}`)}>Abrir</Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Slug (aparece na URL)</Label>
              <div className="flex gap-2 items-center">
                <Input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} className="font-mono" />
                {slug && (
                  slugChecking ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  slugAvailable === true ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                  slugAvailable === false ? <XCircle className="h-4 w-4 text-destructive" /> : null
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">URL: /quiz/{slug || "..."}/[quiz]</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Empresa</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={status === "ativo"} onCheckedChange={v => setStatus(v ? "ativo" : "inativo")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
