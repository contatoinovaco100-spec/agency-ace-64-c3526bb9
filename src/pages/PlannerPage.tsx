import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Film, Image as ImageIcon, Loader2, Search, Timer } from "lucide-react";
import { isReferenceAttachment } from "@/lib/attachmentPurpose";

type Task = {
  id: string; title: string; task_type: string; status: string; client_id: string | null;
  post_date: string | null; post_time: string | null; due_date: string | null;
  video_url: string | null; platform: string | null;
};
type Attachment = { task_id: string; file_url: string; file_type: string };
type Client = { id: string; company_name: string };

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ALL = "todos";
const MONTH_VISIBLE = 2;
const DONE = ["Postado", "Concluído", "Finalizado", "Publicado"];
const SCHEDULED = ["Programado"];
const STORAGE_KEY = "planner:client";
const TASK_FIELDS = "id,title,task_type,status,client_id,post_date,post_time,due_date,video_url,platform";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isImage = (a: Attachment) => /^image\//.test(a.file_type) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.file_url);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const stage = (s: string) => DONE.includes(s) ? "done" : SCHEDULED.includes(s) ? "scheduled" : "progress";

const STAGE_STYLE = {
  done: { card: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  scheduled: { card: "bg-sky-500/10 border-sky-500/30", text: "text-sky-600 dark:text-sky-400", Icon: CalendarClock },
  progress: { card: "bg-orange-500/10 border-orange-500/30", text: "text-orange-600 dark:text-orange-400", Icon: Timer },
} as const;

function ClientAvatar({ name, className = "h-8 w-8 text-xs" }: { name: string; className?: string }) {
  return <div className={`shrink-0 rounded-md bg-primary/15 text-primary font-bold flex items-center justify-center ${className}`}>{initials(name)}</div>;
}

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [type, setType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [undated, setUndated] = useState<Task[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [panelTab, setPanelTab] = useState<"summary" | "undated">("summary");

  const clientId = params.get("cliente");
  const isAll = clientId === ALL;
  const client = clients.find((c) => c.id === clientId);
  const clientName = isAll ? "Todos os clientes" : client?.company_name;
  const clientNames = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.company_name])), [clients]);

  const selectClient = (id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* armazenamento indisponível */ }
    setParams((p) => { p.set("cliente", id); return p; }, { replace: true });
    setPickerOpen(false); setSearch("");
  };

  useEffect(() => {
    supabase.from("clients").select("id, company_name").is("deleted_at", null).order("company_name")
      .then(({ data }) => setClients((data ?? []) as Client[]));
  }, []);

  // Sem cliente na URL: abre o último usado ou o primeiro da lista
  useEffect(() => {
    if (!clients.length || client || isAll) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* armazenamento indisponível */ }
    selectClient(saved === ALL || clients.some((c) => c.id === saved) ? saved! : clients[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, client, isAll]);

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
    if (!clientId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const base = () => {
        const q = supabase.from("tasks").select(TASK_FIELDS).is("deleted_at", null);
        return clientId === ALL ? q : q.eq("client_id", clientId);
      };
      const [{ data }, { data: noDate }] = await Promise.all([
        base().or(`and(post_date.gte.${from},post_date.lte.${to}),and(post_date.is.null,due_date.gte.${from},due_date.lte.${to})`)
          .limit(2000),
        base().is("post_date", null).is("due_date", null).order("created_at", { ascending: false }).limit(100),
      ]);
      const list = (data ?? []) as Task[];
      const all = [...list, ...((noDate ?? []) as Task[])];
      const ids = all.map((t) => t.id);
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
      setTasks(list); setUndated((noDate ?? []) as Task[]); setThumbs(map); setLoading(false);
    })();
    return () => { active = false; };
  }, [from, to, clientId]);

  const matches = (t: Task) =>
    (type === "all" || (type === "arte" ? t.task_type === "Arte" : t.task_type !== "Arte")) &&
    (statusFilter === "all" || stage(t.status) === statusFilter);

  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.filter(matches).forEach((t) => { const d = t.post_date ?? t.due_date; if (d) (m[d] ||= []).push(t); });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.post_time ?? "99").localeCompare(b.post_time ?? "99")));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, type, statusFilter]);

  const summary = useMemo(() => {
    const inRange = view === "month"
      ? tasks.filter((t) => (t.post_date ?? t.due_date ?? "").slice(0, 7) === iso(anchor).slice(0, 7))
      : tasks;
    return {
      total: inRange.length,
      done: inRange.filter((t) => stage(t.status) === "done").length,
      scheduled: inRange.filter((t) => stage(t.status) === "scheduled").length,
      progress: inRange.filter((t) => stage(t.status) === "progress").length,
    };
  }, [tasks, view, anchor]);

  const today = iso(new Date());
  const step = (n: number) => setAnchor(view === "week" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  const a = days[0], b = days[days.length - 1];
  const label = view === "month" ? `${MONTHS_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`
    : a.getMonth() === b.getMonth() ? `${MONTHS[a.getMonth()]} ${a.getFullYear()}` : `${MONTHS[a.getMonth()]} - ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;

  const openTask = (t: Task) => { window.location.href = t.task_type === "Arte" ? `/artes?task=${t.id}` : `/tarefas?task=${t.id}`; };
  const filteredClients = clients.filter((c) => c.company_name.toLowerCase().includes(search.trim().toLowerCase()));

  const ClientOption = ({ id, name, hint }: { id: string; name: string; hint?: string }) => (
    <button onClick={() => selectClient(id)}
      className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition hover:bg-muted ${id === clientId ? "bg-primary/10" : ""}`}>
      <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${id === clientId ? "border-primary bg-primary shadow-[inset_0_0_0_2px_hsl(var(--background))]" : "border-muted-foreground/40"}`} />
      <ClientAvatar name={id === ALL ? "Todos" : name} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );

  const Thumb = ({ t, className }: { t: Task; className: string }) => {
    const isArte = t.task_type === "Arte";
    return (
      <div className={`relative overflow-hidden rounded bg-muted flex items-center justify-center ${className}`}>
        {thumbs[t.id] ? <img src={thumbs[t.id]} alt={t.title} loading="lazy" crossOrigin="anonymous" className="h-full w-full object-cover" />
          : t.video_url ? <video src={t.video_url} muted preload="metadata" crossOrigin="anonymous" className="h-full w-full object-cover" />
          : isArte ? <ImageIcon className="h-6 w-6 text-muted-foreground" /> : <Film className="h-6 w-6 text-muted-foreground" />}
        <span className="absolute bottom-1 right-1 rounded bg-background/80 p-0.5">
          {isArte ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
        </span>
      </div>
    );
  };

  const ownerName = (t: Task) => (t.client_id && clientNames[t.client_id]) || "Sem cliente";

  const Card = ({ t }: { t: Task }) => {
    const s = STAGE_STYLE[stage(t.status)];
    const time = t.post_time?.slice(0, 5);
    return (
      <button onClick={() => openTask(t)} title={t.title}
        className={`w-full text-left rounded-md border p-2 transition hover:shadow-md hover:border-primary ${s.card}`}>
        <div className={`flex items-center gap-1 text-xs font-semibold ${s.text}`}>
          <s.Icon className="h-3.5 w-3.5" />{time ?? (t.post_date ? "sem horário" : "prazo")}
        </div>
        <Thumb t={t} className="mt-1.5 aspect-[16/10] w-full" />
        <p className="mt-1.5 text-xs font-medium truncate text-foreground">{t.title}</p>
        {isAll && <p className="text-[11px] font-medium truncate text-muted-foreground">{ownerName(t)}</p>}
        <p className={`text-[11px] truncate ${s.text}`}>{t.status}</p>
      </button>
    );
  };

  // Linha única da visão de mês: status + horário + tipo, como no planejador da Meta
  const Chip = ({ t }: { t: Task }) => {
    const s = STAGE_STYLE[stage(t.status)];
    const time = t.post_time?.slice(0, 5) ?? (t.post_date ? "--:--" : "prazo");
    return (
      <button onClick={() => openTask(t)} title={`${isAll ? `${ownerName(t)} · ` : ""}${t.title} · ${t.status}`}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-semibold transition hover:ring-1 hover:ring-primary ${s.card} border-0 ${s.text}`}>
        <s.Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0">{time}</span>
        {isAll && <span className="truncate font-normal text-foreground/80">{ownerName(t)}</span>}
        {t.task_type === "Arte" ? <ImageIcon className="ml-auto h-3.5 w-3.5 shrink-0" /> : <Film className="ml-auto h-3.5 w-3.5 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Planejador</h1>
          <p className="text-sm text-muted-foreground">Calendário de conteúdo de cada cliente, com as tarefas do kanban e das artes.</p>
        </div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 pl-2 pr-3 max-w-[280px]">
              <ClientAvatar name={isAll ? "Todos" : client?.company_name ?? "?"} className="h-7 w-7 text-[11px]" />
              <span className="truncate font-semibold">{clientName ?? "Escolher cliente"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-0">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar cliente" className="pl-8" />
              </div>
            </div>
            <div className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">Clientes ({filteredClients.length})</div>
            <div className="max-h-[360px] overflow-y-auto p-2 pt-0">
              {!search.trim() && (
                <>
                  <ClientOption id={ALL} name="Todos os clientes" hint={`${clients.length} clientes no mesmo calendário`} />
                  <div className="my-1 border-t" />
                </>
              )}
              {filteredClients.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
              {filteredClients.map((c) => <ClientOption key={c.id} id={c.id} name={c.company_name} />)}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-1 items-center gap-3 border-b p-3 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-1">
            <div className="flex rounded-md bg-muted p-1">
              {(["week", "month"] as const).map((v) => (
                <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"}
                  className={view === v ? "bg-primary/15 text-primary hover:bg-primary/20" : ""} onClick={() => setView(v)}>
                  {v === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>
            <Button size="icon" variant="ghost" className="ml-2" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>Hoje</Button>
            <Button size="icon" variant="ghost" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
            {loading && <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <h2 className="text-center text-lg font-semibold">{label}</h2>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tipo de conteúdo: todos</SelectItem>
                <SelectItem value="arte">Artes estáticas</SelectItem>
                <SelectItem value="video">Vídeos (kanban)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: todos</SelectItem>
                <SelectItem value="progress">Em produção</SelectItem>
                <SelectItem value="scheduled">Programado</SelectItem>
                <SelectItem value="done">Publicado / concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className={view === "week" ? "min-w-[840px]" : "min-w-[900px]"}>
              <div className="grid grid-cols-7 border-b">
                {(view === "week" ? days : days.slice(0, 7)).map((d) => {
                  const isToday = view === "week" && iso(d) === today;
                  return (
                    <div key={iso(d)} className="flex justify-center py-2.5">
                      <span className={`rounded px-3 py-0.5 text-sm ${isToday ? "bg-primary text-primary-foreground font-semibold" : view === "month" ? "text-foreground" : "text-muted-foreground"}`}>
                        {view === "week" ? `${DAYS[d.getDay()]} ${d.getDate()}` : DAYS_FULL[d.getDay()]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  const key = iso(d); const list = byDay[key] ?? [];
                  const out = view === "month" && d.getMonth() !== anchor.getMonth();
                  const isToday = key === today;
                  if (view === "month") {
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={key} className={`h-[150px] space-y-1.5 border-b p-1.5 ${i % 7 ? "border-l" : ""} ${isToday ? "bg-primary/10" : weekend ? "bg-muted/40" : ""}`}>
                        <div className={`px-1 pb-1 pt-0.5 text-sm ${isToday ? "font-bold text-primary" : out ? "text-muted-foreground" : "text-foreground"}`}>{d.getDate()}</div>
                        {list.slice(0, MONTH_VISIBLE).map((t) => <Chip key={t.id} t={t} />)}
                        {list.length > MONTH_VISIBLE && (
                          <button className="px-1 text-xs font-medium text-primary hover:underline" onClick={() => { setAnchor(d); setView("week"); }}>
                            + {list.length - MONTH_VISIBLE} mais
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={`min-h-[560px] space-y-2 p-2 ${i % 7 ? "border-l" : ""} ${isToday ? "bg-primary/5 ring-1 ring-inset ring-primary/60" : ""}`}>
                      {list.map((t) => <Card key={t.id} t={t} />)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="border-t p-4 xl:w-[300px] xl:shrink-0 xl:border-l xl:border-t-0">
            <div className="flex gap-1 border-b pb-3">
              {([["summary", "Resumo"], ["undated", `Sem data (${undated.length})`]] as const).map(([k, l]) => (
                <Button key={k} size="sm" variant="ghost" onClick={() => setPanelTab(k)}
                  className={panelTab === k ? "bg-primary/15 text-primary hover:bg-primary/20" : ""}>{l}</Button>
              ))}
            </div>
            {panelTab === "summary" ? (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3">
                  <ClientAvatar name={isAll ? "Todos" : client?.company_name ?? "?"} className="h-10 w-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{clientName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{view === "week" ? "Nesta semana" : "Neste mês"}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-3xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">conteúdos no calendário</p>
                </div>
                {(["progress", "scheduled", "done"] as const).map((k) => {
                  const s = STAGE_STYLE[k];
                  return (
                    <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}
                      className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition hover:border-primary ${statusFilter === k ? s.card : ""}`}>
                      <s.Icon className={`h-4 w-4 ${s.text}`} />
                      <span className="flex-1">{k === "progress" ? "Em produção" : k === "scheduled" ? "Programados" : "Publicados / concluídos"}</span>
                      <span className="font-semibold">{summary[k]}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 pt-4">
                {undated.length === 0 && <p className="text-sm text-muted-foreground">Todos os conteúdos deste cliente têm data.</p>}
                {undated.map((t) => (
                  <button key={t.id} onClick={() => openTask(t)} className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition hover:border-primary">
                    <Thumb t={t} className="h-12 w-12" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {isAll && <p className="truncate text-xs text-muted-foreground">{ownerName(t)}</p>}
                      <p className={`truncate text-xs ${STAGE_STYLE[stage(t.status)].text}`}>{t.status}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
