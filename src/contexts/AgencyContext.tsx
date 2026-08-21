import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Task, Lead, TeamMember, CalendarEvent, ServiceType, TaskChecklistItem, TaskComment, TaskAttachment, TaskStageHistory } from '@/types/agency';
import { useAuth } from '@/contexts/AuthContext';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toDatabaseTaskStatus, toUiTaskStatus } from '@/lib/taskStatus';

interface AgencyContextType {
  clients: Client[];
  tasks: Task[];
  leads: Lead[];
  team: TeamMember[];
  events: CalendarEvent[];
  loading: boolean;
  /** IDs of clients the current user manages (null = no restriction). Non-admins see only their clients. */
  allowedClientIds: string[] | null;
  addClient: (client: Client) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  moveTaskToStage: (taskId: string, newStatus: string, extra?: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  deletedTasks: Task[];
  advanceVideoStage: (task: Task, changedBy: string) => Promise<void>;
  addLead: (lead: Lead) => Promise<void>;
  updateLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertLeadToClient: (leadId: string, clientData: Partial<Client>) => Promise<void>;
  addEvent: (event: CalendarEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getChecklist: (taskId: string) => Promise<TaskChecklistItem[]>;
  upsertChecklistItem: (item: TaskChecklistItem) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
  getComments: (taskId: string) => Promise<TaskComment[]>;
  addComment: (comment: TaskComment) => Promise<void>;
  getAttachments: (taskId: string) => Promise<TaskAttachment[]>;
  addAttachment: (attachment: TaskAttachment) => Promise<void>;
  deleteAttachment: (id: string) => Promise<void>;
  getStageHistory: (taskId: string) => Promise<TaskStageHistory[]>;
  refresh: () => Promise<void>;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

function rowToClient(row: Tables<'clients'>): Client {
  return {
    id: row.id, companyName: row.company_name, contactName: row.contact_name,
    email: row.email, phone: row.phone, contractStartDate: row.contract_start_date || '',
    monthlyValue: Number(row.monthly_value), scope: row.scope,
    serviceType: row.service_type as ServiceType[], accountManager: row.account_manager || [],
    status: row.status as Client['status'], notes: row.notes,
    cancelledAt: (row as any).cancelled_at || null,
    scopeDetails: {
      monthlyDeliverables: row.scope_monthly_deliverables || [],
      includedServices: row.scope_included_services || [],
      demandLimits: row.scope_demand_limits,
      platforms: row.scope_platforms || [],
      strategicNotes: row.scope_strategic_notes,
    },
  };
}

function clientToRow(c: Client): TablesInsert<'clients'> {
  return {
    id: c.id, company_name: c.companyName, contact_name: c.contactName,
    email: c.email, phone: c.phone, contract_start_date: c.contractStartDate || null,
    monthly_value: c.monthlyValue, scope: c.scope, service_type: c.serviceType,
    account_manager: c.accountManager || [], status: c.status, notes: c.notes,
    scope_monthly_deliverables: c.scopeDetails?.monthlyDeliverables || [],
    scope_included_services: c.scopeDetails?.includedServices || [],
    scope_demand_limits: c.scopeDetails?.demandLimits || '',
    scope_platforms: c.scopeDetails?.platforms || [],
    scope_strategic_notes: c.scopeDetails?.strategicNotes || '',
  };
}

function rowToTask(row: any): Task {
  return {
    id: row.id, clientId: row.client_id || '', title: row.title, description: row.description,
    assignee: row.assignee, priority: row.priority, dueDate: row.due_date || '', status: toUiTaskStatus(row.status) as Task['status'],
    taskType: row.task_type || 'Geral',
    videoName: row.video_name || '', platform: row.platform || '', format: row.format || '',
    videoObjective: row.video_objective || '', scriptWriter: row.script_writer || '',
    editor: row.editor || '', videoIdea: row.video_idea || '', fullScript: row.full_script || '',
    videoReferences: row.video_references || '', observations: row.observations || '',
    creativeDirection: row.creative_direction || '', editingStyle: row.editing_style || '',
    strategicNotes: row.strategic_notes || '', recordingNotes: row.recording_notes || '',
    editorComments: row.editor_comments || '', currentStageOwner: row.current_stage_owner || '',
    copywriter: row.copywriter || '', director: row.director || '', videomaker: row.videomaker || '',
    videoUrl: row.video_url || '',
    rawFootageUrl: row.raw_footage_url || '',
    caption: (row as any).caption || '',
    postDate: row.post_date || '', postTime: row.post_time || '',
    approvedByClient: row.approved_by_client || false,
    approvedAt: row.approved_at || '',
    deletedAt: (row as any).deleted_at || null,
  };
}

function rowToLead(row: Tables<'leads'>): Lead {
  return {
    id: row.id, name: row.name, company: row.company, email: row.email, phone: row.phone,
    source: row.source, assignee: row.assignee, closer: (row as any).closer || '', notes: row.notes,
    stage: row.stage as Lead['stage'], estimatedValue: Number(row.estimated_value), createdAt: row.created_at,
  };
}
// Team members are derived from `profiles` (employees with username) — single source of truth.
const EMPLOYEE_EMAIL_DOMAIN = 'inovaco.app';
function profileToTeamMember(row: any, adminIds: Set<string>): TeamMember {
  return {
    id: row.id,
    name: row.full_name || 'Sem nome',
    role: row.job_title || '',
    email: row.username ? `${row.username}@${EMPLOYEE_EMAIL_DOMAIN}` : '',
    permissions: adminIds.has(row.id) ? 'Admin' : 'Editor',
    avatar: row.avatar_url || undefined,
  };
}
function rowToEvent(row: Tables<'calendar_events'>): CalendarEvent {
  return { id: row.id, title: row.title, date: row.date, type: row.type as CalendarEvent['type'], clientId: row.client_id || undefined };
}

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedClientIds, setAllowedClientIds] = useState<string[] | null>(null);
  const [userFullName, setUserFullName] = useState('');

  // Check role & access
  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => {
        const admin = !!data && data.length > 0;
        setIsAdmin(admin);
      });
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => setUserFullName(data?.full_name || ''));
  }, [user]);

  // Non-admins only see the clients whose "Responsável pela conta" is themselves.
  const visibleClientIds = useMemo<string[] | null>(() => {
    if (!user || isAdmin) return null;
    const name = userFullName.trim().toLowerCase();
    if (!name) return [];
    return allClients
      .filter(c => (c.accountManager || []).some(m => m.trim().toLowerCase() === name))
      .map(c => c.id);
  }, [user, isAdmin, userFullName, allClients]);

  useEffect(() => { setAllowedClientIds(visibleClientIds); }, [visibleClientIds]);

  // Filtered clients
  const clients = useMemo(() => {
    if (!allowedClientIds) return allClients;
    return allClients.filter(c => allowedClientIds.includes(c.id));
  }, [allowedClientIds, allClients]);

  // Filtered tasks (clientless tasks stay visible to everyone, deleted tasks are excluded)
  const visibleTasks = useMemo(() => {
    const active = tasks.filter(t => !t.deletedAt);
    if (!allowedClientIds) return active;
    return active.filter(t => !t.clientId || allowedClientIds.includes(t.clientId));
  }, [allowedClientIds, tasks]);

  const deletedTasks = useMemo(() => {
    const deleted = tasks.filter(t => !!t.deletedAt);
    if (!allowedClientIds) return deleted;
    return deleted.filter(t => !t.clientId || allowedClientIds.includes(t.clientId));
  }, [allowedClientIds, tasks]);

  // Filtered events (events without a client stay visible to everyone)
  const visibleEvents = useMemo(() => {
    if (!allowedClientIds) return events;
    return events.filter(e => !e.clientId || allowedClientIds.includes(e.clientId));
  }, [allowedClientIds, events]);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, tRes, lRes, pRes, rRes, eRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('leads').select('*').order('created_at'),
      supabase.from('profiles').select('id, full_name, username, job_title, avatar_url, is_active').not('username', 'is', null).eq('is_active', true),
      supabase.from('user_roles').select('user_id').eq('role', 'admin'),
      supabase.from('calendar_events').select('*').order('date'),
    ]);
    if (cRes.data) setAllClients(cRes.data.map(rowToClient));
    if (tRes.data) setTasks(tRes.data.map(rowToTask));
    if (lRes.data) setLeads(lRes.data.map(rowToLead));
    if (pRes.data) {
      const adminIds = new Set((rRes.data ?? []).map((r: any) => r.user_id));
      setTeam(pRes.data.map((p: any) => profileToTeamMember(p, adminIds)).sort((a, b) => a.name.localeCompare(b.name)));
    }
    if (eRes.data) setEvents(eRes.data.map(rowToEvent));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription for clients table (auto-create on contract signing, etc.)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('clients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newClient = rowToClient(payload.new as Tables<'clients'>);
          setAllClients(prev => prev.some(c => c.id === newClient.id) ? prev : [...prev, newClient]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = rowToClient(payload.new as Tables<'clients'>);
          setAllClients(prev => prev.map(c => c.id === updated.id ? updated : c));
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setAllClients(prev => prev.filter(c => c.id !== oldId));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Realtime para tasks e calendar_events: mantém kanbans e calendário
  // atualizados ao vivo quando outra pessoa cria/edita/move tarefas.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('agency-data-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const row = rowToTask(payload.new as any);
        setTasks(prev => prev.some(t => t.id === row.id) ? prev : [...prev, row]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const row = rowToTask(payload.new as any);
        setTasks(prev => prev.map(t => t.id === row.id ? row : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) setTasks(prev => prev.filter(t => t.id !== oldId));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, (payload) => {
        const ev = rowToEvent(payload.new as any);
        setEvents(prev => prev.some(e => e.id === ev.id) ? prev : [...prev, ev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_events' }, (payload) => {
        const ev = rowToEvent(payload.new as any);
        setEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calendar_events' }, (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) setEvents(prev => prev.filter(e => e.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const taskToRow = (t: Task) => ({
    id: t.id, client_id: t.clientId || null, title: t.title, description: t.description,
    assignee: t.assignee, priority: t.priority, due_date: t.dueDate || null, status: toDatabaseTaskStatus(t.status),
    task_type: t.taskType, video_name: t.videoName, platform: t.platform, format: t.format,
    video_objective: t.videoObjective, script_writer: t.scriptWriter, editor: t.editor,
    video_idea: t.videoIdea, full_script: t.fullScript, video_references: t.videoReferences,
    observations: t.observations, creative_direction: t.creativeDirection,
    editing_style: t.editingStyle, strategic_notes: t.strategicNotes,
    recording_notes: t.recordingNotes, editor_comments: t.editorComments,
    current_stage_owner: t.currentStageOwner, copywriter: t.copywriter,
    director: t.director, videomaker: t.videomaker,
    video_url: t.videoUrl || null,
    raw_footage_url: t.rawFootageUrl || null,
    post_date: t.postDate || null, post_time: t.postTime || null,
    caption: t.caption || null,
  });

  const addClient = async (c: Client) => {
    await supabase.from('clients').insert(clientToRow(c));
    setAllClients(prev => [...prev, c]);
  };
  const updateClient = async (c: Client) => {
    const { id, ...rest } = clientToRow(c);
    await supabase.from('clients').update(rest).eq('id', c.id);
    setAllClients(prev => prev.map(x => x.id === c.id ? c : x));
  };
  const deleteClient = async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    setAllClients(prev => prev.filter(x => x.id !== id));
  };

  const addTask = async (t: Task) => {
    const { error } = await supabase.from('tasks').insert(taskToRow(t) as any);
    if (error) { console.error('Error inserting task:', error); throw error; }
    if (t.taskType === 'Produção de Vídeo') {
      const items = ['Corte correto', 'Legendas aplicadas', 'Música aplicada', 'Identidade visual aplicada', 'Revisão final feita']
        .map((label, i) => ({ id: crypto.randomUUID(), task_id: t.id, label, checked: false, sort_order: i }));
      await supabase.from('task_checklist_items').insert(items);
    }
    setTasks(prev => [...prev, t]);
  };

  const updateTask = async (t: Task) => {
    const { id, ...rest } = taskToRow(t);
    const prevTask = tasks.find(x => x.id === t.id);
    // Optimistic update: reflect the change in UI immediately.
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
    const { error } = await supabase.from('tasks').update(rest as any).eq('id', t.id);
    if (error) {
      // Rollback if the database update fails.
      if (prevTask) setTasks(prev => prev.map(x => x.id === t.id ? prevTask : x));
      console.error('Failed to update task', error);
      throw error;
    }
    if (prevTask && prevTask.status !== t.status && user) {
      try {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        const changedBy = (prof?.full_name || user.email || 'Desconhecido').toString();
        await supabase.from('task_stage_history').insert({
          task_id: t.id,
          from_stage: prevTask.status,
          to_stage: t.status,
          changed_by: changedBy,
        } as any);
      } catch (e) {
        console.error('Failed to log stage change', e);
      }
    }
  };

  // Move a task between kanban stages. Only updates the columns that actually
  // changed (status + optional fields) to avoid failing or overwriting when the
  // card doesn't have all its information filled in yet.
  const moveTaskToStage = async (taskId: string, newStatus: string, extra?: Partial<Task>) => {
    const prevTask = tasks.find(x => x.id === taskId);
    if (!prevTask) return;
    const updated = { ...prevTask, status: newStatus as Task['status'], ...extra };
    // Optimistic update: reflect the change in UI immediately.
    setTasks(prev => prev.map(x => x.id === taskId ? updated : x));
    // Build a targeted patch — never send the whole row, so a card can be moved
    // without having all the mandatory fields filled.
    const row: { status: string; due_date?: string | null } = { status: toDatabaseTaskStatus(newStatus) };
    if (extra && 'dueDate' in extra) row.due_date = extra.dueDate || null;
    const { error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', taskId);
    if (error) {
      // Rollback if the database update fails.
      setTasks(prev => prev.map(x => x.id === taskId ? prevTask : x));
      console.error('Failed to move task', error);
      throw error;
    }
    if (prevTask.status !== newStatus && user) {
      try {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        const changedBy = (prof?.full_name || user.email || 'Desconhecido').toString();
        await supabase.from('task_stage_history').insert({
          task_id: taskId,
          from_stage: toDatabaseTaskStatus(prevTask.status),
          to_stage: toDatabaseTaskStatus(newStatus),
          changed_by: changedBy,
        } as any);
      } catch (e) {
        console.error('Failed to log stage change', e);
      }
    }
  };

  const deleteTask = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('tasks').update({ deleted_at: now } as any).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deletedAt: now } : t));
  };

  const restoreTask = async (id: string) => {
    await supabase.from('tasks').update({ deleted_at: null } as any).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deletedAt: null } : t));
  };

  const advanceVideoStage = async (task: Task, changedBy: string) => {
    const stages = ['Em copy', 'Em direção', 'Em gravação', 'Em edição', 'Finalizado'];
    const idx = stages.indexOf(toDatabaseTaskStatus(task.status));
    if (idx < 0 || idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1];
    const ownerMap: Record<string, string> = {
      'Em direção': task.director,
      'Em gravação': task.videomaker,
      'Em edição': task.editor,
      'Finalizado': '',
    };
    const updated = { ...task, status: toUiTaskStatus(nextStage) as Task['status'], currentStageOwner: ownerMap[nextStage] || '' };
    await updateTask(updated);
    await supabase.from('task_stage_history').insert({
      task_id: task.id, from_stage: toDatabaseTaskStatus(task.status), to_stage: nextStage, changed_by: changedBy,
    } as any);
  };

  const addLead = async (l: Lead) => {
    await supabase.from('leads').insert({ id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, assignee: l.assignee, closer: l.closer, notes: l.notes, stage: l.stage, estimated_value: l.estimatedValue } as any);
    setLeads(prev => [...prev, l]);
  };
  const updateLead = async (l: Lead) => {
    await supabase.from('leads').update({ name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, assignee: l.assignee, closer: l.closer, notes: l.notes, stage: l.stage, estimated_value: l.estimatedValue } as any).eq('id', l.id);
    setLeads(prev => prev.map(x => x.id === l.id ? l : x));
  };
  const deleteLead = async (id: string) => {
    await supabase.from('leads').delete().eq('id', id);
    setLeads(prev => prev.filter(x => x.id !== id));
  };

  const convertLeadToClient = async (leadId: string, clientData: Partial<Client>) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const newClient: Client = {
      id: crypto.randomUUID(), companyName: lead.company, contactName: lead.name,
      email: lead.email, phone: lead.phone, contractStartDate: new Date().toISOString().split('T')[0],
      monthlyValue: clientData.monthlyValue || lead.estimatedValue, scope: clientData.scope || '',
      serviceType: clientData.serviceType || [], accountManager: lead.assignee ? [lead.assignee] : [], status: 'Ativo',
      notes: lead.notes, scopeDetails: clientData.scopeDetails || { monthlyDeliverables: [], includedServices: [], demandLimits: '', platforms: [], strategicNotes: '' },
    };
    await addClient(newClient);
    await updateLead({ ...lead, stage: 'Cliente fechado' });
  };

  // Team members are now derived from `profiles` (see fetchAll). Manage employees in /funcionarios.

  const addEvent = async (e: CalendarEvent) => {
    await supabase.from('calendar_events').insert({ id: e.id, title: e.title, date: e.date, type: e.type, client_id: e.clientId || null });
    setEvents(prev => [...prev, e]);
  };
  const deleteEvent = async (id: string) => {
    await supabase.from('calendar_events').delete().eq('id', id);
    setEvents(prev => prev.filter(x => x.id !== id));
  };

  const getChecklist = async (taskId: string): Promise<TaskChecklistItem[]> => {
    const { data } = await supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('sort_order');
    return (data || []).map((r: any) => ({ id: r.id, taskId: r.task_id, label: r.label, checked: r.checked, sortOrder: r.sort_order }));
  };
  const upsertChecklistItem = async (item: TaskChecklistItem) => { await supabase.from('task_checklist_items').upsert({ id: item.id, task_id: item.taskId, label: item.label, checked: item.checked, sort_order: item.sortOrder }); };
  const deleteChecklistItem = async (id: string) => { await supabase.from('task_checklist_items').delete().eq('id', id); };

  const getComments = async (taskId: string): Promise<TaskComment[]> => {
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at');
    return (data || []).map((r: any) => ({ id: r.id, taskId: r.task_id, author: r.author, content: r.content, createdAt: r.created_at }));
  };
  const addComment = async (comment: TaskComment) => { await supabase.from('task_comments').insert({ id: comment.id, task_id: comment.taskId, author: comment.author, content: comment.content }); };

  const getAttachments = async (taskId: string): Promise<TaskAttachment[]> => {
    const { data } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at');
    return (data || []).map((r: any) => ({ id: r.id, taskId: r.task_id, fileName: r.file_name, fileUrl: r.file_url, fileType: r.file_type, createdAt: r.created_at }));
  };
  const addAttachment = async (att: TaskAttachment) => { await supabase.from('task_attachments').insert({ id: att.id, task_id: att.taskId, file_name: att.fileName, file_url: att.fileUrl, file_type: att.fileType }); };
  const deleteAttachment = async (id: string) => { await supabase.from('task_attachments').delete().eq('id', id); };

  const getStageHistory = async (taskId: string): Promise<TaskStageHistory[]> => {
    const { data } = await supabase.from('task_stage_history').select('*').eq('task_id', taskId).order('created_at');
    return (data || []).map((r: any) => ({ id: r.id, taskId: r.task_id, fromStage: r.from_stage, toStage: r.to_stage, changedBy: r.changed_by, createdAt: r.created_at }));
  };

  return (
    <AgencyContext.Provider value={{
      clients, tasks: visibleTasks, leads, team, events: visibleEvents, loading, allowedClientIds,
      addClient, updateClient, deleteClient,
      addTask, updateTask, deleteTask, restoreTask, deletedTasks, moveTaskToStage, advanceVideoStage,
      addLead, updateLead, deleteLead, convertLeadToClient,
      
      addEvent, deleteEvent,
      getChecklist, upsertChecklistItem, deleteChecklistItem,
      getComments, addComment, getAttachments, addAttachment, deleteAttachment,
      getStageHistory, refresh: fetchAll,
    }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within AgencyProvider');
  return ctx;
}
