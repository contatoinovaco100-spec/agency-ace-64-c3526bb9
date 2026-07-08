import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Copy, Plus, Loader2, ListChecks,
  Calendar, TrendingUp, Trash2, X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type ClientRow = {
  id: string;
  company_name: string;
  status: string;
  scope_monthly_deliverables: string[] | null;
  contract_start_date: string | null;
};

const statusStyles: Record<string, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Pausado: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Cancelado: "bg-red-500/15 text-red-500 border-red-500/30",
};

export default function ClientScopesPage() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const formattedMonth = format(currentMonth, "yyyy-MM-dd");

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["clients-for-scopes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, status, scope_monthly_deliverables, contract_start_date")
        .order("company_name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const { data: scopes, isLoading: loadingScopes } = useQuery({
    queryKey: ["client-scopes-month", formattedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_scopes")
        .select("*, tasks:client_scope_tasks(*)")
        .eq("month", formattedMonth);
      if (error) throw error;
      return data;
    },
    enabled: !!formattedMonth,
  });

  const createScopeMutation = useMutation({
    mutationFn: async ({ clientId, generateFromPrevious }: { clientId: string; generateFromPrevious: boolean }) => {
      const { data: newScope, error: createError } = await supabase
        .from("client_scopes")
        .insert({ client_id: clientId, month: formattedMonth })
        .select()
        .single();
      if (createError) throw createError;

      let tasksToCopy: { name: string; description?: string }[] = [];
      if (generateFromPrevious) {
        const prevMonth = format(subMonths(parseISO(formattedMonth), 1), "yyyy-MM-dd");
        const { data: prevScope } = await supabase
          .from("client_scopes").select("id")
          .eq("client_id", clientId).eq("month", prevMonth).maybeSingle();
        if (prevScope) {
          const { data: prevTasks } = await supabase
            .from("client_scope_tasks").select("name, description").eq("scope_id", prevScope.id);
          if (prevTasks) tasksToCopy = prevTasks;
        }
      }
      if (tasksToCopy.length === 0) {
        const client = clients?.find(c => c.id === clientId);
        if (client?.scope_monthly_deliverables?.length) {
          tasksToCopy = client.scope_monthly_deliverables.map((t: string) => ({ name: t }));
        }
      }
      if (tasksToCopy.length > 0) {
        const tasksToInsert = tasksToCopy.map(t => ({
          scope_id: newScope.id, name: t.name, description: t.description ?? null, status: "Pendente",
        }));
        const { error: insertError } = await supabase.from("client_scope_tasks").insert(tasksToInsert);
        if (insertError) throw insertError;
      }
      return newScope;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] });
      toast.success("Escopo gerado com sucesso!");
    },
    onError: (error: any) => toast.error(`Erro: ${error.message || "Tente novamente."}`),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === "Concluído" ? "Pendente" : "Concluído";
      const completedAt = newStatus === "Concluído" ? new Date().toISOString() : null;
      const { error } = await supabase.from("client_scope_tasks")
        .update({ status: newStatus, completed_at: completedAt }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async ({ scopeId, name }: { scopeId: string; name: string }) => {
      const { error } = await supabase.from("client_scope_tasks")
        .insert({ scope_id: scopeId, name, status: "Pendente" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("client_scope_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] }),
  });

  const scopeByClient = useMemo(() => {
    const m = new Map<string, any>();
    scopes?.forEach(s => m.set(s.client_id, s));
    return m;
  }, [scopes]);

  const openClient = clients?.find(c => c.id === openClientId);
  const openScope = openClientId ? scopeByClient.get(openClientId) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-7 w-7 text-primary" />
            Escopo dos Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhamento mensal de entregas contratadas.
          </p>
        </div>
        <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="px-4 font-medium text-center min-w-[140px] capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {(loadingClients || loadingScopes) && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients?.map(client => {
          const scope = scopeByClient.get(client.id);
          const tasks = scope?.tasks ?? [];
          const total = tasks.length;
          const done = tasks.filter((t: any) => t.status === "Concluído").length;
          const progress = total === 0 ? 0 : Math.round((done / total) * 100);
          const deliverables = client.scope_monthly_deliverables ?? [];
          const statusClass = statusStyles[client.status] ?? "bg-muted text-muted-foreground border-border";

          return (
            <Card
              key={client.id}
              onClick={() => setOpenClientId(client.id)}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40 flex flex-col"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight line-clamp-2">
                    {client.company_name}
                  </CardTitle>
                  <Badge variant="outline" className={`shrink-0 ${statusClass}`}>
                    {client.status}
                  </Badge>
                </div>
                {client.contract_start_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    Início: {format(parseISO(client.contract_start_date), "dd/MM/yyyy")}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                {deliverables.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {deliverables.slice(0, 6).map((d, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {d}
                      </Badge>
                    ))}
                    {deliverables.length > 6 && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        +{deliverables.length - 6}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sem entregáveis definidos</p>
                )}

                <div className="mt-auto pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {scope ? `${done} de ${total} concluídas` : "Nenhum escopo neste mês"}
                    </span>
                    {scope && <span className="font-medium">{progress}%</span>}
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!openClientId} onOpenChange={(o) => !o && setOpenClientId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-xl">{openClient?.company_name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
              {openClient && (
                <Badge variant="outline" className={statusStyles[openClient.status] ?? ""}>
                  {openClient.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {openClient && !openScope && (
            <div className="py-6 text-center space-y-3">
              <p className="text-muted-foreground">Nenhum escopo gerado para este mês.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  onClick={() => createScopeMutation.mutate({ clientId: openClient.id, generateFromPrevious: true })}
                  disabled={createScopeMutation.isPending}
                >
                  {createScopeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copiar mês anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => createScopeMutation.mutate({ clientId: openClient.id, generateFromPrevious: false })}
                  disabled={createScopeMutation.isPending}
                >
                  Gerar do contrato
                </Button>
              </div>
            </div>
          )}

          {openScope && (
            <div className="space-y-3">
              {openScope.tasks?.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Nenhuma tarefa cadastrada.</p>
              )}
              <div className="divide-y rounded-md border">
                {openScope.tasks?.map((task: any) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 transition-colors hover:bg-muted/40 ${task.status === "Concluído" ? "opacity-70" : ""}`}
                  >
                    <Checkbox
                      checked={task.status === "Concluído"}
                      onCheckedChange={() => toggleTaskMutation.mutate({ taskId: task.id, currentStatus: task.status })}
                      className="mt-1 h-5 w-5"
                    />
                    <div className="flex-1 space-y-0.5">
                      <p className={`text-sm font-medium ${task.status === "Concluído" ? "line-through text-muted-foreground" : ""}`}>
                        {task.name}
                      </p>
                      {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                      {task.completed_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Concluído em {format(new Date(task.completed_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (window.confirm("Remover tarefa?")) deleteTaskMutation.mutate(task.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const input = form.elements.namedItem('taskName') as HTMLInputElement;
                  if (input.value.trim()) {
                    addTaskMutation.mutate({ scopeId: openScope.id, name: input.value.trim() });
                    input.value = "";
                  }
                }}
                className="flex gap-2"
              >
                <Input name="taskName" placeholder="Nova tarefa..." className="flex-1" />
                <Button type="submit" disabled={addTaskMutation.isPending}>
                  {addTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
