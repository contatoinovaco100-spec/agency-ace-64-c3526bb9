import { useState, useMemo } from "react";
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [newTaskName, setNewTaskName] = useState("");

  const formattedMonth = format(currentMonth, "yyyy-MM-dd");

  // Fetch Clients
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

  // Fetch current month scope for selected client
  const { data: currentScope, isLoading: loadingScope } = useQuery({
    queryKey: ["client-scope", selectedClientId, formattedMonth],
    queryFn: async () => {
      if (!selectedClientId) return null;

      // Ensure month is saved as YYYY-MM-DD
      const { data: scopes, error: scopeError } = await supabase
        .from("client_scopes")
        .select("*, tasks:client_scope_tasks(*)")
        .eq("client_id", selectedClientId)
        .eq("month", formattedMonth)
        .maybeSingle();

      if (scopeError) throw scopeError;

      if (!scopes) {
        return null; // Handle creation later
      }

      // Sort tasks by created_at
      if (scopes.tasks) {
        scopes.tasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      return scopes;
    },
    enabled: !!selectedClientId,
  });

  // Create scope mutation
  const createScopeMutation = useMutation({
    mutationFn: async ({ clientId, month, generateFromPrevious }: { clientId: string, month: string, generateFromPrevious: boolean }) => {
      // 1. Create the scope
      const { data: newScope, error: createError } = await supabase
        .from("client_scopes")
        .insert({ client_id: clientId, month })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Fetch tasks to copy
      let tasksToCopy: { name: string, description?: string }[] = [];

      if (generateFromPrevious) {
        // Find previous month
        const prevMonth = format(subMonths(parseISO(month), 1), "yyyy-MM-dd");
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
          if (prevTasks) {
            tasksToCopy = prevTasks;
          }
        }
      }

      // If no tasks from previous, try to use the client's default template
      if (tasksToCopy.length === 0) {
        const client = clients?.find(c => c.id === clientId);
        if (client?.scope_monthly_deliverables && client.scope_monthly_deliverables.length > 0) {
          tasksToCopy = client.scope_monthly_deliverables.map((item: string) => ({ name: item }));
        }
      }

      // 3. Insert copied tasks
      if (tasksToCopy.length > 0) {
        const tasksToInsert = tasksToCopy.map(t => ({
          scope_id: newScope.id,
          name: t.name,
          description: t.description || null,
          status: 'Pendente'
        }));
        const { error: insertTasksError } = await supabase
          .from("client_scope_tasks")
          .insert(tasksToInsert);
        if (insertTasksError) throw insertTasksError;
      }

      return newScope;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scope", selectedClientId, formattedMonth] });
      toast.success("Escopo do mês gerado com sucesso!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao gerar escopo do mês.");
    }
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async ({ scopeId, name }: { scopeId: string, name: string }) => {
      const { data, error } = await supabase
        .from("client_scope_tasks")
        .insert({ scope_id: scopeId, name, status: 'Pendente' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scope", selectedClientId, formattedMonth] });
      setNewTaskName("");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao adicionar tarefa.");
    }
  });

  // Toggle task mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string, currentStatus: string }) => {
      const newStatus = currentStatus === 'Concluído' ? 'Pendente' : 'Concluído';
      const completedAt = newStatus === 'Concluído' ? new Date().toISOString() : null;

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
      queryClient.invalidateQueries({ queryKey: ["client-scope", selectedClientId, formattedMonth] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao atualizar tarefa.");
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("client_scope_tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-scope", selectedClientId, formattedMonth] });
      toast.success("Tarefa removida.");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao remover tarefa.");
    }
  });

  const handleGenerateMonth = (generateFromPrevious = true) => {
    if (!selectedClientId) return;
    createScopeMutation.mutate({ clientId: selectedClientId, month: formattedMonth, generateFromPrevious });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentScope || !newTaskName.trim()) return;
    addTaskMutation.mutate({ scopeId: currentScope.id, name: newTaskName.trim() });
  };

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const isCurrentMonthActual = isSameMonth(currentMonth, new Date());
  
  // Progress calculations
  const totalTasks = currentScope?.tasks?.length || 0;
  const completedTasks = currentScope?.tasks?.filter((t: any) => t.status === 'Concluído').length || 0;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const selectedClientData = clients?.find(c => c.id === selectedClientId);

  if (!selectedClientId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ListChecks className="h-8 w-8 text-primary" />
              Escopo do Cliente
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhamento mensal das entregas contratadas
            </p>
          </div>
        </div>

        <Card className="max-w-md mx-auto mt-12 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Selecione um Cliente</CardTitle>
            <CardDescription>
              Escolha um cliente para visualizar ou editar seu escopo mensal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClients ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button 
            onClick={() => setSelectedClientId(null)}
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para lista
          </button>
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedClientData?.company_name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de escopo e entregas
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
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

      {loadingScope ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !currentScope ? (
        <Card className="bg-card/50 backdrop-blur border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ListChecks className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum escopo para este mês</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              O escopo de entregas para {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })} ainda não foi gerado.
            </p>
            <div className="flex gap-4">
              <Button 
                onClick={() => handleGenerateMonth(true)}
                disabled={createScopeMutation.isPending}
              >
                {createScopeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                Copiar do Mês Anterior
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleGenerateMonth(false)}
                disabled={createScopeMutation.isPending}
              >
                Gerar Escopo Vazio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Card */}
          <Card className="bg-gradient-to-r from-card to-secondary/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Progresso do Mês</p>
                  <h3 className="text-3xl font-bold">{progressPercent}%</h3>
                </div>
                <div className="text-right">
                  <Badge variant={progressPercent === 100 ? "default" : "secondary"} className="mb-2">
                    {progressPercent === 100 ? "Concluído" : "Em Andamento"}
                  </Badge>
                  <p className="text-sm font-medium">
                    {completedTasks} de {totalTasks} tarefas concluídas
                  </p>
                </div>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </CardContent>
          </Card>

          {/* Checklist Card */}
          <Card>
            <CardHeader className="pb-4 border-b">
              <div className="flex justify-between items-center">
                <CardTitle>Entregáveis do Mês</CardTitle>
                {!isCurrentMonthActual && (
                  <Badge variant="outline" className="bg-muted">
                    Histórico
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {currentScope.tasks?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhuma tarefa adicionada neste escopo.
                  </div>
                ) : (
                  currentScope.tasks?.map((task: any) => (
                    <div 
                      key={task.id} 
                      className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 ${task.status === 'Concluído' ? 'opacity-70' : ''}`}
                    >
                      <Checkbox 
                        id={task.id} 
                        checked={task.status === 'Concluído'}
                        onCheckedChange={() => toggleTaskMutation.mutate({ taskId: task.id, currentStatus: task.status })}
                        disabled={toggleTaskMutation.isPending && toggleTaskMutation.variables?.taskId === task.id}
                        className="mt-1 h-5 w-5"
                      />
                      <div className="flex-1 space-y-1">
                        <label 
                          htmlFor={task.id} 
                          className={`text-sm font-medium leading-none cursor-pointer ${task.status === 'Concluído' ? 'line-through text-muted-foreground' : ''}`}
                        >
                          {task.name}
                        </label>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">
                            {task.description}
                          </p>
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
                            if(window.confirm("Deseja realmente remover esta tarefa?")) {
                              deleteTaskMutation.mutate(task.id);
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            
            {/* Add Task Form - Only for Admins */}
            {isAdmin && (
              <div className="p-4 bg-muted/30 border-t rounded-b-xl">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <Input 
                    placeholder="Adicionar nova tarefa ao escopo..." 
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!newTaskName.trim() || addTaskMutation.isPending}>
                    {addTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Adicionar
                  </Button>
                </form>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
