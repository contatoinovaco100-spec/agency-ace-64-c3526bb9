import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Clock, Film, Image as ImageIcon, Loader2 } from "lucide-react";
import { isReferenceAttachment } from "@/lib/attachmentPurpose";

type Task = {
  id: string; title: string; task_type: string; status: string; client_id: string | null;
  post_date: string | null; post_time: string | null; due_date: string | null;
  video_url: string | null; platform: string | null;
};
type Attachment = { task_id: string; file_url: string; file_type: string };

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DONE = ["Postado", "Concluído", "Finalizado", "Programado"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isImage = (a: Attachment) => /^image\//.test(a.file_type) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.file_url);

export default function PlannerPage() {
  const [view, setView] = useState<"week" | "month" | "client">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [type, setType] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => {
    if (view === "week") {
      const start = addDays(anchor, -anchor.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const from = iso(days[0]); const to = iso(days[days.length - 1]);

  useEffect(() => {
    supabase.from("clients").select("id, company_name").is("deleted_at", null).order("company_name")
      .then(({ data }) => setClients(Object.fromEntries((data ?? []).map((c) => [c.id, c.company_name]))));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let query = supabase.from("tasks")
        .select("id,title,task_type,status,client_id,post_date,post_time,due_date,video_url,platform")
        .is("deleted_at", null)
        .limit(2000);
      if (view !== "client") {
        query = query.or(`and(post_date.gte.${from},post_date.lte.${to}),and(post_date.is.null,due_date.gte.${from},due_date.lte.${to})`);
      }
      const { data } = await query;
      const list = (data ?? []) as Task[];
      const ids = list.map((t) => t.id);
      const map: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: att } = await supabase.from("task_attachments")
          .select("task_id,file_url,file_type").in("task_id", ids.slice(i, i + 200));
        (att ?? []).forEach((a: Attachment) => {
          // Bucket é público: usa a URL gravada direto; ignora referências
          if (!map[a.task_id] && isImage(a) && !isReferenceAttachment(a.file_url)) map[a.task_id] = a.file_url;
        });
      }
      if (!active) return;
      setTasks(list); setThumbs(map); setLoading(false);
    })();
    return () => { active = false; };
  }, [from, to, view]);

  const filtered = tasks.filter((t) =>
    (type === "all" || (type === "arte" ? t.task_type === "Arte" : t.task_type !== "Arte")) &&
    (clientFilter === "all" || t.client_id === clientFilter));

  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    filtered.forEach((t) => { const d = t.post_date ?? t.due_date; if (d) (m[d] ||= []).push(t); });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.post_time ?? "99").localeCompare(b.post_time ?? "99")));
    return m;
  }, [filtered]);

  const byClient = useMemo(() => {
    const m: Record<string, Task[]> = {};
    filtered.forEach((t) => { const k = t.client_id ?? "none"; (m[k] ||= []).push(t); });
    return Object.entries(m)
      .sort((a, b) => (clients[a[0]] ?? "").localeCompare(clients[b[0]] ?? ""))
      .map(([cid, list]) => ({
        client: cid === "none" ? "Sem cliente" : (clients[cid] ?? "Cliente removido"),
        list: list.sort((a, b) => {
          const da = a.post_date ?? a.due_date ?? "9999"; const db = b.post_date ?? b.due_date ?? "9999";
          return da.localeCompare(db) || (a.post_time ?? "99").localeCompare(b.post_time ?? "99");
        }),
      }));
  }, [filtered, clients]);

  const today = iso(new Date());
  const step = (n: number) => setAnchor(view === "week" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  const a = days[0], b = days[days.length - 1];
  const label = view === "month" ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : a.getMonth() === b.getMonth() ? `${MONTHS[a.getMonth()]} ${a.getFullYear()}` : `${MONTHS[a.getMonth()]} - ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;

  const openTask = (t: Task) => { window.location.href = t.task_type === "Arte" ? `/artes?task=${t.id}` : `/tarefas?task=${t.id}`; };

  const Card = ({ t, compact }: { t: Task; compact?: boolean }) => {
    const done = DONE.includes(t.status);
    const isArte = t.task_type === "Arte";
    return (
      <button onClick={() => openTask(t)}
        className={`w-full text-left rounded-md border p-2 transition hover:border-primary ${done ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
        {(() => { const d = t.post_date ?? t.due_date; return d ? (
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />{d.slice(8, 10)}/{d.slice(5, 7)}{t.post_time ? ` ${t.post_time.slice(0, 5)}` : ""}
            {isArte ? <ImageIcon className="h-3 w-3 ml-auto" /> : <Film className="h-3 w-3 ml-auto" />}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />sem data
            {isArte ? <ImageIcon className="h-3 w-3 ml-auto" /> : <Film className="h-3 w-3 ml-auto" />}
          </div>
        ); })()}
        {!compact && (
          <div className="mt-1 aspect-[4/3] w-full overflow-hidden rounded bg-muted flex items-center justify-center">
            {thumbs[t.id] ? <img src={thumbs[t.id]} alt={t.title} loading="lazy" crossOrigin="anonymous" className="h-full w-full object-cover" />
              : t.video_url ? <video src={t.video_url} muted preload="metadata" crossOrigin="anonymous" className="h-full w-full object-cover" />
              : isArte ? <ImageIcon className="h-6 w-6 text-muted-foreground" /> : <Film className="h-6 w-6 text-muted-foreground" />}
          </div>
        )}
        <p className="mt-1 text-xs font-medium truncate">{t.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{(t.client_id && clients[t.client_id]) || "Sem cliente"}</p>
        <p className={`text-[11px] truncate ${done ? "text-primary" : "text-muted-foreground"}`}>{t.status}</p>
      </button>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Planner</h1>
        <p className="text-sm text-muted-foreground">Calendário de conteúdo com as tarefas do kanban e das artes estáticas.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="flex rounded-md bg-muted p-1">
          {(["week", "month", "client"] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "ghost"} onClick={() => setView(v)}>{v === "week" ? "Semana" : v === "month" ? "Mês" : "Por cliente"}</Button>
          ))}
        </div>
        {view !== "client" && (
          <>
            <Button size="icon" variant="ghost" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>Hoje</Button>
            <Button size="icon" variant="ghost" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-semibold capitalize ml-2">{label}</span>
          </>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo: Tudo</SelectItem>
              <SelectItem value="arte">Artes estáticas</SelectItem>
              <SelectItem value="video">Vídeos (kanban)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cliente: todos</SelectItem>
              {Object.entries(clients).map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "client" ? (
        <div className="space-y-4">
          {byClient.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada com os filtros atuais.</p>
          )}
          {byClient.map(({ client, list }) => (
            <div key={client} className="rounded-lg border bg-card p-3 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{client}</h2>
                <span className="text-xs text-muted-foreground">({list.length})</span>
              </div>
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {list.map((t) => <Card key={t.id} t={t} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className={`grid grid-cols-7 gap-2 ${view === "week" ? "min-w-[980px]" : "min-w-[760px]"}`}>
            {DAYS.map((d) => view === "month" && <div key={d} className="text-center text-xs text-muted-foreground">{d}</div>)}
            {days.map((d) => {
              const key = iso(d); const list = byDay[key] ?? [];
              const out = view === "month" && d.getMonth() !== anchor.getMonth();
              return (
                <div key={key} className={`rounded-lg border p-2 space-y-2 ${view === "month" ? "min-h-[120px]" : "min-h-[400px]"} ${out ? "opacity-40" : ""} ${key === today ? "border-primary" : "border-border"}`}>
                  <div className={`text-center text-sm rounded py-0.5 ${key === today ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
                    {view === "week" ? `${DAYS[d.getDay()]} ${d.getDate()}` : d.getDate()}
                    {list.length > 0 && <span className="ml-1 text-[10px]">({list.length})</span>}
                  </div>
                  {(view === "month" ? list.slice(0, 3) : list).map((t) => <Card key={t.id} t={t} compact={view === "month"} />)}
                  {view === "month" && list.length > 3 && (
                    <button className="text-xs text-primary" onClick={() => { setAnchor(d); setView("week"); }}>+{list.length - 3} mais</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
