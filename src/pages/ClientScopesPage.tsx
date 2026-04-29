import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, startOfMonth, parseISO, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Copy, Plus, Loader2, ListChecks, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageAccess } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ClientScopesPage() {
  const { user } = useAuth();
  const { isAdmin } = usePageAccess();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  const formattedMonth = format(currentMonth, "yyyy-MM-dd");

  // Fetch all active clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["clients-for-scopes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, status, scope_monthly_deliverables")
        .eq("status", "Ativo")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all scopes (with tasks) for the selected month
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

  // Mutation to create a scope (copying from previous month or template)
  const createScopeMutation = useMutation({
    mutationFn: async ({ clientId, generateFromPrevious }: { clientId: string; generateFromPrevious: boolean }) => {
      // 1. Create the scope row
      const { data: newScope, error: createError } = await supabase
        .from("client_scopes")
        .insert({ client_id: clientId, month: formattedMonth })
        .select()
        .single();
      if (createError) throw createError;

      // 2. Determine tasks to copy
      let tasksToCopy: { name: string; description?: string }[] = [];
      if (generateFromPrevious) {
        const prevMonth = format(subMonths(parseISO(formattedMonth), 1), "yyyy-MM-dd");
        const { data: prevScope } = await supabase
          .from("client_scopes")
          .select("id")
          .eq("client_id", clientId)
          .eq("month", prevMonth)
          .maybeSingle();
        if (prevScope) {
          const { data: prevTasks } = await supabase
            .from("client_scope_tasks")
            .select("name, description")
            .eq("scope_id", prevScope.id);
          if (prevTasks) tasksToCopy = prevTasks;
        }
      }

      if (tasksToCopy.length === 0) {
        const client = clients?.find(c => c.id === clientId);
        if (client?.scope_monthly_deliverables?.length) {
          tasksToCopy = client.scope_monthly_deliverables.map((t: string) => ({ name: t }));
        }
      }

      // 3. Insert tasks if any
      if (tasksToCopy.length > 0) {
        const tasksToInsert = tasksToCopy.map(t => ({
          scope_id: newScope.id,
          name: t.name,
          description: t.description ?? null,
          status: "Pendente",
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
    onError: (error) => {
      console.error("Error generating scope:", error);
      toast.error(`Erro ao gerar escopo: ${error.message || "Tente novamente mais tarde."}`);
    },
  });

  // Mutation to toggle task status
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === "Concluído" ? "Pendente" : "Concluído";
      const completedAt = newStatus === "Concluído" ? new Date().toISOString() : null;
      const { data, error } = await supabase
        .from("client_scope_tasks")
        .update({ status: newStatus, completed_at: completedAt })
        .eq("id", taskId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] });
    },
    onError: () => {
      toast.error("Erro ao atualizar tarefa.");
    },
  });

  // Mutation to add a new task to an existing scope
  const addTaskMutation = useMutation({
    mutationFn: async ({ scopeId, name }: { scopeId: string; name: string }) => {
      const { data, error } = await supabase
        .from("client_scope_tasks")
        .insert({ scope_id: scopeId, name, status: "Pendente" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] });
    },
    onError: () => {
      toast.error("Erro ao adicionar tarefa.");
    },
  });

  // Mutation to delete a task (admin only)
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("client_scope_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scopes-month", formattedMonth] });
      toast.success("Tarefa removida.");
    },
    onError: () => {
      toast.error("Erro ao remover tarefa.");
    },
  });

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const isCurrentMonthActual = isSameMonth(currentMonth, new Date());

  // UI Rendering ----------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header with month selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-8 w-8 text-primary" />
            Escopo dos Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhamento mensal de entregas contratadas de todos os clientes.
          </p>
        </div>
        <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="px-4 font-medium text-center min-w-[140px] capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {(loadingClients || loadingScopes) && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* List all clients */}
      {clients?.map(client => {
        const scope = scopes?.find(s => s.client_id === client.id);
        const tasks = scope?.tasks ?? [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: any) => t.status === "Concluído").length;
        const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        return (
          <Card key={client.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-4 border-b flex justify-between items-start">
              <div>
                <CardTitle>{client.company_name}</CardTitle>
                <CardDescription>{client.scope_monthly_deliverables?.length ? "Entregáveis padrão do contrato" : "Sem entregáveis definidos"}</CardDescription>
              </div>
              {/* Progress */}
              <div className="text-right">
                <Badge variant={progress === 100 ? "default" : "secondary"}>{progress === 100 ? "Concluído" : "Em Andamento"}</Badge>
                <p className="text-sm font-medium mt-1">
                  {completedTasks} de {totalTasks} concluídas
                </p>
                <Progress value={progress} className="h-2 mt-1" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Caso não exista escopo ainda */}
              {!scope && (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">Nenhum escopo gerado para este mês.</p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => createScopeMutation.mutate({ clientId: client.id, generateFromPrevious: true })}
                      disabled={createScopeMutation.isPending}
                    >
                      {createScopeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copiar do mês anterior
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => createScopeMutation.mutate({ clientId: client.id, generateFromPrevious: false })}
                      disabled={createScopeMutation.isPending}
                    >
                      Gerar vazio
                    </Button>
                  </div>
                </div>
              )}
              {/* Lista de tarefas */}
              {scope && tasks.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">Nenhuma tarefa cadastrada.</div>
              )}
              {scope && tasks.length > 0 && (
                <div className="divide-y">
                  {tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 ${task.status === "Concluído" ? "opacity-70" : ""}`}
                    >
                      <Checkbox
                        id={task.id}
                        checked={task.status === "Concluído"}
                        onCheckedChange={() => toggleTaskMutation.mutate({ taskId: task.id, currentStatus: task.status })}
                        disabled={toggleTaskMutation.isPending && toggleTaskMutation.variables?.taskId === task.id}
                        className="mt-1 h-5 w-5"
                      />
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor={task.id}
                          className={`text-sm font-medium leading-none cursor-pointer ${task.status === "Concluído" ? "line-through text-muted-foreground" : ""}`}
                        >
                          {task.name}
                        </label>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                        {task.completed_at && (
                          <p className="text-xs text-muted-foreground">
                            Concluído em: {format(new Date(task.completed_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => {
                            if (window.confirm("Remover tarefa?")) deleteTaskMutation.mutate(task.id);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {/* Formulário de inserção de nova tarefa (admin) */}
            {isAdmin && scope && (
              <div className="p-4 bg-muted/30 border-t">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const nameInput = form.elements.namedItem('taskName') as HTMLInputElement;
                    if (nameInput.value.trim()) {
                      addTaskMutation.mutate({ scopeId: scope.id, name: nameInput.value.trim() });
                      nameInput.value = "";
                    }
                  }}
                  className="flex gap-2"
                >
                  <Input name="taskName" placeholder="Nova tarefa..." className="flex-1" />
                  <Button type="submit" disabled={addTaskMutation.isPending}>
                    {addTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Adicionar
                  </Button>
                </form>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
