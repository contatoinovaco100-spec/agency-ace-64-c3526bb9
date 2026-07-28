import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAgency } from '@/contexts/AgencyContext';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskPriority, TaskType } from '@/types/agency';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskType: TaskType;
  defaultStage: string;
  defaultClientId?: string;
}

interface ParsedRow {
  title: string;
  clientName?: string;
  clientId?: string;
  assignee?: string;
  dueDate?: string;
  priority?: TaskPriority;
  description?: string;
  postDate?: string;
  postTime?: string;
  references?: string;
  error?: string;
}

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function parseDate(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

function parsePriority(v?: string): TaskPriority {
  const s = (v || '').trim().toLowerCase();
  if (s.startsWith('a')) return 'Alta';
  if (s.startsWith('b')) return 'Baixa';
  return 'Média';
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === ';') { result.push(cur); cur = ''; }
      else cur += c;
    }
  }
  result.push(cur);
  return result;
}

export function BulkImportDialog({ open, onOpenChange, taskType, defaultStage, defaultClientId }: Props) {
  const { clients, team, addTask } = useAgency();
  const { toast } = useToast();
  const [mode, setMode] = useState<'ai' | 'sheet'>('ai');
  const [raw, setRaw] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiRows, setAiRows] = useState<ParsedRow[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const [fallbackClientId, setFallbackClientId] = useState<string>(defaultClientId || '');
  const [fallbackAssignee, setFallbackAssignee] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const activeClients = useMemo(() => clients.filter(c => c.status === 'Ativo'), [clients]);

  const matchClient = (name?: string) => {
    if (!name) return undefined;
    const n = name.toLowerCase().trim();
    return activeClients.find(c => c.companyName.toLowerCase() === n)
      || activeClients.find(c => c.companyName.toLowerCase().includes(n));
  };

  const sheetParsed = useMemo<ParsedRow[]>(() => {
    if (!raw.trim()) return [];
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];

    let headerMap: Record<string, number> | null = null;
    let dataLines = lines;

    if (hasHeader) {
      const headers = splitLine(lines[0]).map(normalizeHeader);
      headerMap = {};
      headers.forEach((h, i) => { headerMap![h] = i; });
      dataLines = lines.slice(1);
    }

    const findIdx = (keys: string[]) => {
      if (!headerMap) return -1;
      for (const k of keys) if (headerMap[k] !== undefined) return headerMap[k];
      return -1;
    };

    const idxTitle = hasHeader ? findIdx(['titulo', 'title', 'tarefa', 'nome']) : 0;
    const idxClient = hasHeader ? findIdx(['cliente', 'client']) : 1;
    const idxAssignee = hasHeader ? findIdx(['responsavel', 'assignee', 'resp']) : 2;
    const idxDate = hasHeader ? findIdx(['data', 'prazo', 'due', 'due_date']) : 3;
    const idxPriority = hasHeader ? findIdx(['prioridade', 'priority']) : 4;
    const idxDesc = hasHeader ? findIdx(['descricao', 'description', 'desc']) : 5;
    const idxRefs = hasHeader ? findIdx(['referencia', 'referencias', 'references', 'ref']) : -1;
    const idxPostDate = hasHeader ? findIdx(['data_post', 'post_date', 'data_postagem']) : -1;
    const idxPostTime = hasHeader ? findIdx(['hora_post', 'post_time', 'hora']) : -1;

    return dataLines.map<ParsedRow>(line => {
      const cols = splitLine(line);
      const get = (i: number) => (i >= 0 && cols[i] ? cols[i].trim() : '');
      const title = get(idxTitle);
      const clientName = get(idxClient);
      const matched = matchClient(clientName);
      const row: ParsedRow = {
        title,
        clientName: clientName || undefined,
        clientId: matched?.id || fallbackClientId || undefined,
        assignee: get(idxAssignee) || fallbackAssignee || undefined,
        dueDate: parseDate(get(idxDate)),
        priority: parsePriority(get(idxPriority)),
        description: get(idxDesc) || undefined,
        references: get(idxRefs) || undefined,
        postDate: parseDate(get(idxPostDate)),
        postTime: get(idxPostTime) || undefined,
      };
      if (!row.title) row.error = 'Título vazio';
      else if (!row.clientId) row.error = 'Cliente não encontrado (defina fallback)';
      return row;
    });
  }, [raw, hasHeader, activeClients, fallbackClientId, fallbackAssignee]);

  const parsed = mode === 'ai' ? aiRows : sheetParsed;
  const validRows = parsed.filter(r => !r.error);
  const invalidRows = parsed.filter(r => r.error);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const clientList = activeClients.map(c => c.companyName).join(', ');
      const teamList = team.map(m => m.name).join(', ');
      const systemPrompt = `Você extrai tarefas de um texto livre em português e devolve JSON PURO (sem markdown).
Formato: { "tasks": [ { "title": string, "client": string|null, "assignee": string|null, "dueDate": "YYYY-MM-DD"|null, "priority": "Alta"|"Média"|"Baixa"|null, "description": string|null, "references": string|null, "postDate": "YYYY-MM-DD"|null, "postTime": "HH:MM"|null } ] }
Regras:
- Cada linha ou bloco separado por linhas em branco = 1 tarefa.
- Campos podem vir com rótulos livres (nome, título, cliente, responsavel, referência, link, data, prioridade, etc). Use "|" ou ";" ou "," como separadores dentro da mesma linha.
- "references" recebe URLs (http/www...) ou nomes de referências visuais.
- Se não achar o campo, retorne null.
- Clientes ativos disponíveis: ${clientList || '(nenhum)'}. Combine o nome mesmo se abreviado.
- Equipe: ${teamList || '(nenhuma)'}.
- Tipo de tarefa contexto: ${taskType}.`;

      const { data, error } = await supabase.functions.invoke('ai-copywriter', {
        body: { systemPrompt, userMessage: aiText, model: 'google/gemini-2.5-flash' },
      });
      if (error) throw error;
      const result = (data as { result?: unknown })?.result;
      const tasksArr = Array.isArray(result)
        ? result
        : (result as { tasks?: unknown[] })?.tasks;
      if (!Array.isArray(tasksArr)) throw new Error('IA não retornou lista de tarefas.');

      const rows: ParsedRow[] = tasksArr.map((t) => {
        const it = t as Record<string, string | null | undefined>;
        const matched = matchClient(it.client || undefined);
        const row: ParsedRow = {
          title: (it.title || '').trim(),
          clientName: it.client || undefined,
          clientId: matched?.id || fallbackClientId || undefined,
          assignee: it.assignee || fallbackAssignee || undefined,
          dueDate: parseDate(it.dueDate || undefined),
          priority: parsePriority(it.priority || undefined),
          description: it.description || undefined,
          references: it.references || undefined,
          postDate: parseDate(it.postDate || undefined),
          postTime: it.postTime || undefined,
        };
        if (!row.title) row.error = 'Título vazio';
        else if (!row.clientId) row.error = 'Cliente não encontrado (defina fallback)';
        return row;
      });
      setAiRows(rows);
      toast({ title: `${rows.length} tarefa(s) identificada(s)`, description: 'Revise abaixo antes de criar.' });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Falha ao interpretar com IA';
      toast({ title: 'Erro na IA', description: msg, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const r of validRows) {
      const task: Task = {
        id: crypto.randomUUID(),
        clientId: r.clientId!,
        title: r.title,
        description: r.description || '',
        assignee: r.assignee || '',
        priority: r.priority || 'Média',
        dueDate: r.dueDate || '',
        status: defaultStage as Task['status'],
        taskType,
        videoName: taskType === 'Produção de Vídeo' ? r.title : '',
        platform: '', format: '', videoObjective: '',
        scriptWriter: '', editor: '', videoIdea: '', fullScript: '',
        videoReferences: r.references || '', observations: '',
        creativeDirection: '', editingStyle: '', strategicNotes: '',
        recordingNotes: '', editorComments: '', currentStageOwner: '',
        copywriter: '', director: '', videomaker: '',
        postDate: r.postDate, postTime: r.postTime,
      };
      try { await addTask(task); ok++; } catch (e) { console.error(e); fail++; }
    }
    setImporting(false);
    toast({
      title: fail ? `${ok} criadas, ${fail} falharam` : `${ok} tarefa(s) criadas`,
      description: fail ? 'Verifique o console para detalhes.' : 'Cards adicionados ao Kanban.',
      variant: fail ? 'destructive' : 'default',
    });
    if (!fail) {
      setRaw('');
      setAiText('');
      setAiRows([]);
      onOpenChange(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['titulo', 'cliente', 'responsavel', 'data', 'prioridade', 'descricao', 'referencia', 'data_post', 'hora_post'];
    const example1 = ['Post lançamento', activeClients[0]?.companyName || 'Cliente X', team[0]?.name || 'Maria', '2026-08-01', 'Alta', 'Peça de anúncio', 'https://ref.com/inspiracao', '2026-08-05', '18:00'];
    const example2 = ['Reels tutorial', activeClients[0]?.companyName || 'Cliente X', team[0]?.name || 'João', '2026-08-03', 'Media', '', 'https://instagram.com/p/xyz', '', ''];
    const csv = [headers, example1, example2]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo-tarefas-${taskType.toLowerCase().replace(/\s/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aiExample = `nome - Reels lançamento | 3 cortes\nreferencia - www.instagram.com/p/exemplo\ncliente - Acme\nresponsavel - Maria\ndata - 05/08/2026\n\nnome - Story promoção\nref - www.tal.com\ncliente - Acme`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Criar cards em massa
          </DialogTitle>
          <DialogDescription>
            Cole texto livre e deixe a IA identificar, ou use o modelo de planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Cliente padrão (fallback)</Label>
            <Select value={fallbackClientId || 'none'} onValueChange={v => setFallbackClientId(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Responsável padrão</Label>
            <Select value={fallbackAssignee || 'none'} onValueChange={v => setFallbackAssignee(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'ai' | 'sheet')} className="mt-3">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> IA (texto livre)</TabsTrigger>
            <TabsTrigger value="sheet" className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Planilha</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-3 mt-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium mb-1">Escreva do seu jeito — a IA identifica cada campo:</p>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono">{`nome - VIDEO | 3 cortes\nreferencia - www.tal.com\ncliente - Acme\ndata - 01/08`}</pre>
              <p className="mt-1 text-muted-foreground">Separe várias tarefas com uma linha em branco.</p>
            </div>
            <Textarea
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              placeholder={aiExample}
              rows={10}
              className="font-mono text-xs"
            />
            <div className="flex justify-end">
              <Button onClick={handleAiParse} disabled={!aiText.trim() || aiLoading} variant="secondary" className="gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Interpretar com IA
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sheet" className="space-y-3 mt-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3 text-xs">
              <div>
                <p className="font-medium">Baixe o modelo, preencha e cole aqui</p>
                <p className="text-muted-foreground text-[11px]">Colunas: titulo, cliente, responsavel, data, prioridade, descricao, referencia, data_post, hora_post</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Modelo CSV
              </Button>
            </div>
            <div className="flex items-center justify-end">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
                1ª linha é cabeçalho
              </label>
            </div>
            <Textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder="Cole aqui as linhas do Excel / Google Sheets / CSV"
              rows={8}
              className="font-mono text-xs"
            />
          </TabsContent>
        </Tabs>

        {parsed.length > 0 && (
          <div className="rounded-md border border-border mt-3">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} válidas</span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {invalidRows.length} com erro</span>
                )}
              </div>
              <span className="text-muted-foreground">Etapa: <strong>{defaultStage}</strong></span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Título</th>
                    <th className="px-2 py-1.5">Cliente</th>
                    <th className="px-2 py-1.5">Resp.</th>
                    <th className="px-2 py-1.5">Data</th>
                    <th className="px-2 py-1.5">Ref.</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} className={r.error ? 'bg-destructive/5' : ''}>
                      <td className="px-2 py-1 truncate max-w-[160px]">{r.title || <em className="text-muted-foreground">vazio</em>}</td>
                      <td className="px-2 py-1 truncate max-w-[110px]">
                        {r.clientId
                          ? activeClients.find(c => c.id === r.clientId)?.companyName
                          : <span className="text-muted-foreground">{r.clientName || '—'}</span>}
                      </td>
                      <td className="px-2 py-1 truncate max-w-[90px]">{r.assignee || '—'}</td>
                      <td className="px-2 py-1">{r.dueDate || '—'}</td>
                      <td className="px-2 py-1 truncate max-w-[120px]" title={r.references || ''}>{r.references || '—'}</td>
                      <td className="px-2 py-1">
                        {r.error
                          ? <span className="text-destructive">{r.error}</span>
                          : <span className="text-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!validRows.length || importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Criar {validRows.length || ''} card{validRows.length === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
