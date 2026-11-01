import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { LpEditor } from "@/components/lp/LpEditor";
import { STATIC_LPS, carryLpLinks, fetchStaticLp, lpPublicPath, slugifyLp } from "@/lib/lp-html";
import { Copy, Download, ExternalLink, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

type Lp = { id: string; slug: string; title: string; published: boolean; updated_at: string };


const BLANK_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nova landing page</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#0b0c0c;color:#f4f6f5}
  main{max-width:760px;margin:0 auto;padding:96px 24px;text-align:center}
  h1{font-size:44px;line-height:1.1;margin:0 0 16px}
  p{color:#9ba3a0;font-size:18px;line-height:1.6}
  a{display:inline-block;margin-top:24px;padding:14px 26px;border-radius:999px;background:#22c55e;color:#04140a;font-weight:700;text-decoration:none}
</style>
</head>
<body>
<main>
  <h1>Título da sua landing page</h1>
  <p>Escreva aqui a promessa principal da oferta.</p>
  <a href="#" data-checkout>Quero saber mais</a>
</main>
<script>
const CHECKOUT_URL = 'https://wa.me/55?text=';
document.querySelectorAll('[data-checkout]').forEach(a => { a.href = CHECKOUT_URL; a.target = '_blank'; a.rel = 'noopener'; });
</script>
</body>
</html>`;

export default function MyLandingPagesPage() {
  const [lps, setLps] = useState<Lp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lp | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newBase, setNewBase] = useState("blank");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Lp | null>(null);
  const [refreshing, setRefreshing] = useState<Lp | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("figma_landing_pages").select("id, slug, title, published, updated_at").order("updated_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar LPs", description: error.message, variant: "destructive" });
    setLps(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingStatic = STATIC_LPS.filter(s => !lps.some(l => l.slug === s.slug));

  async function insertLp(slug: string, title: string, html: string) {
    const { data: userData } = await supabase.auth.getUser();
    return supabase.from("figma_landing_pages").insert({
      slug, title, generated_html: html, source_type: "html", published: true, created_by: userData.user?.id,
    }).select("id, slug, title, published, updated_at").single();
  }

  async function importStatic(s: (typeof STATIC_LPS)[number]) {
    setImporting(s.slug);
    try {
      const html = await fetchStaticLp(s.file);
      const { data, error } = await insertLp(s.slug, s.title, html);
      if (error) throw error;
      toast({ title: "LP pronta para editar", description: `${s.title} agora é editada por aqui.` });
      await load();
      setEditing(data);
    } catch (e) {
      toast({ title: "Não foi possível importar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setImporting(null);
    }
  }

  async function createLp() {
    const title = newTitle.trim();
    const slug = slugifyLp(newSlug || title);
    if (!title || !slug) return;
    setBusy(true);
    let html = BLANK_HTML.replace("<title>Nova landing page</title>", `<title>${title.replace(/</g, "")}</title>`);
    if (newBase !== "blank") {
      const { data } = await supabase.from("figma_landing_pages").select("generated_html").eq("id", newBase).single();
      html = data?.generated_html ?? html;
    }
    const { data, error } = await insertLp(slug, title, html);
    setBusy(false);
    if (error) {
      toast({
        title: "Não foi possível criar",
        description: error.code === "23505" ? "Já existe uma LP com esse endereço." : error.message,
        variant: "destructive",
      });
      return;
    }
    setCreating(false); setNewTitle(""); setNewSlug(""); setNewBase("blank");
    await load();
    setEditing(data);
  }

  // Traz a versão nova do arquivo da LP e mantém os links que o usuário configurou
  async function refreshFromStatic(lp: Lp) {
    const s = STATIC_LPS.find(x => x.slug === lp.slug);
    if (!s) return;
    setBusy(true);
    try {
      const [fresh, { data, error: readErr }] = await Promise.all([
        fetchStaticLp(s.file),
        supabase.from("figma_landing_pages").select("generated_html").eq("id", lp.id).single(),
      ]);
      if (readErr) throw readErr;
      const html = carryLpLinks(data?.generated_html ?? "", fresh);
      const { error } = await supabase.from("figma_landing_pages").update({ generated_html: html }).eq("id", lp.id);
      if (error) throw error;
      toast({ title: "LP atualizada", description: "A versão nova já está no ar, com os seus links." });
      load();
    } catch (e) {
      toast({ title: "Não foi possível atualizar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      setRefreshing(null);
    }
  }

  async function togglePublished(lp: Lp) {
    const { error } = await supabase.from("figma_landing_pages").update({ published: !lp.published }).eq("id", lp.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: lp.published ? "LP tirada do ar" : "LP publicada" });
    load();
  }

  async function removeLp(lp: Lp) {
    const { error } = await supabase.from("figma_landing_pages").delete().eq("id", lp.id);
    setDeleting(null);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    toast({ title: "LP excluída" });
    load();
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(window.location.origin + lpPublicPath(slug));
    toast({ title: "Link copiado" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Minhas LPs"
        description="Suas landing pages em um só lugar. Edite textos, links e imagens e publique na hora."
        actions={
          <Button className="h-10 gap-1.5 active:scale-[0.97]" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova LP
          </Button>
        }
      />

      {pendingStatic.map(s => (
        <Card key={s.slug} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{s.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Está no ar em <span className="font-mono text-xs text-foreground/80">{s.path}</span>, mas ainda não pode ser editada por aqui.
            </p>
          </div>
          <Button variant="outline" className="h-10 gap-1.5" onClick={() => importStatic(s)} disabled={importing === s.slug}>
            {importing === s.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Trazer para o editor
          </Button>
        </Card>
      ))}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : lps.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-medium">Nenhuma LP ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie a primeira ou traga uma LP que já está no ar.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {lps.map(lp => (
            <div key={lp.id} className="flex items-center gap-3 p-4 sm:px-5">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(lp)}>
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{lp.title}</p>
                  <Badge variant={lp.published ? "default" : "secondary"} className="shrink-0 text-[11px]">
                    {lp.published ? "No ar" : "Rascunho"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{lpPublicPath(lp.slug)}</span>
                  <span className="hidden sm:inline"> · editada em {new Date(lp.updated_at).toLocaleDateString("pt-BR")}</span>
                </p>
              </button>
              <Button variant="outline" size="sm" className="hidden h-9 gap-1.5 sm:flex" onClick={() => setEditing(lp)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(lp)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(lpPublicPath(lp.slug), "_blank")}><ExternalLink className="mr-2 h-4 w-4" /> Abrir</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyLink(lp.slug)}><Copy className="mr-2 h-4 w-4" /> Copiar link</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => togglePublished(lp)}>
                    {lp.published ? <><EyeOff className="mr-2 h-4 w-4" /> Tirar do ar</> : <><Eye className="mr-2 h-4 w-4" /> Publicar</>}
                  </DropdownMenuItem>
                  {STATIC_LPS.some(s => s.slug === lp.slug) && (
                    <DropdownMenuItem onClick={() => setRefreshing(lp)}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar com a versão nova</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(lp)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova LP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lp-title">Nome</Label>
              <Input id="lp-title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex.: Mentoria turma 2" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-slug">Endereço</Label>
              <div className="flex items-center rounded-md border border-input pl-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">/lp/</span>
                <input
                  id="lp-slug"
                  value={newSlug}
                  onChange={e => setNewSlug(slugifyLp(e.target.value))}
                  placeholder={slugifyLp(newTitle) || "mentoria-turma-2"}
                  className="h-10 min-w-0 flex-1 bg-transparent pr-3 font-mono text-xs outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Começar de</Label>
              <Select value={newBase} onValueChange={setNewBase}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Página em branco</SelectItem>
                  {lps.map(lp => <SelectItem key={lp.id} value={lp.id}>Cópia de {lp.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={createLp} disabled={busy || !newTitle.trim()} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O link {deleting && lpPublicPath(deleting.slug)} para de funcionar. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && removeLp(deleting)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!refreshing} onOpenChange={o => !o && !busy && setRefreshing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar “{refreshing?.title}” com a versão nova?</AlertDialogTitle>
            <AlertDialogDescription>
              Entram as seções e animações novas. Seus links (WhatsApp, checkout, Instagram) são mantidos, mas textos e imagens que você mudou no editor voltam para os da versão nova.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); if (refreshing) refreshFromStatic(refreshing); }}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <LpEditor
          id={editing.id}
          publicPath={lpPublicPath(editing.slug)}
          onClose={changed => { setEditing(null); if (changed) load(); }}
        />
      )}
    </div>
  );
}
