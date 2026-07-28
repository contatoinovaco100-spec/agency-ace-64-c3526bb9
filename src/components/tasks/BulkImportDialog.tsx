import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAgency } from '@/contexts/AgencyContext';
import { Task, TaskPriority, TaskType } from '@/types/agency';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

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
  error?: string;
}

const HEADERS_HELP = [
  'titulo (obrigatório)',
  'cliente',
  'responsavel',
  'data (YYYY-MM-DD ou DD/MM/YYYY)',
  'prioridade (Alta/Média/Baixa)',
  'descricao',
  'data_post',
  'hora_post',
];

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
  // Detect delimiter: tab has priority (Excel paste), else CSV with quotes
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
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [fallbackClientId, setFallbackClientId] = useState<string>(defaultClientId || '');
  const [fallbackAssignee, setFallbackAssignee] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const activeClients = useMemo(() => clients.filter(c => c.status === 'Ativo'), [clients]);

  const parsed = useMemo<ParsedRow[]>(() => {
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
    const idxPostDate = hasHeader ? findIdx(['data_post', 'post_date', 'data_postagem']) : -1;
    const idxPostTime = hasHeader ? findIdx(['hora_post', 'post_time', 'hora']) : -1;

    return dataLines.map<ParsedRow>(line => {
      const cols = splitLine(line);
      const get = (i: number) => (i >= 0 && cols[i] ? cols[i].trim() : '');
      const title = get(idxTitle);
      const clientName = get(idxClient);
      const matched = clientName
        ? activeClients.find(c => c.companyName.toLowerCase() === clientName.toLowerCase())
          || activeClients.find(c => c.companyName.toLowerCase().includes(clientName.toLowerCase()))
        : undefined;
      const row: ParsedRow = {
        title,
        clientName: clientName || undefined,
        clientId: matched?.id || fallbackClientId || undefined,
        assignee: get(idxAssignee) || fallbackAssignee || undefined,
        dueDate: parseDate(get(idxDate)),
        priority: parsePriority(get(idxPriority)),
        description: get(idxDesc) || undefined,
        postDate: parseDate(get(idxPostDate)),
        postTime: get(idxPostTime) || undefined,
      };
      if (!row.title) row.error = 'Título vazio';
      else if (!row.clientId) row.error = 'Cliente não encontrado (defina fallback)';
      return row;
    });
  }, [raw, hasHeader, activeClients, fallbackClientId, fallbackAssignee]);

  const validRows = parsed.filter(r => !r.error);
  const invalidRows = parsed.filter(r => r.error);

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
        status: defaultStage as any,
        taskType,
        videoName: taskType === 'Produção de Vídeo' ? r.title : '',
        platform: '', format: '', videoObjective: '',
        scriptWriter: '', editor: '', videoIdea: '', fullScript: '',
        videoReferences: '', observations: '',
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
      onOpenChange(false);
    }
  };

  const example = taskType === 'Arte'
    ? 'titulo\tcliente\tresponsavel\tdata\tprioridade\nPost lançamento\tAcme\tMaria\t2026-08-01\tAlta\nStory promo\tAcme\tMaria\t2026-08-02\tMedia'
    : 'titulo\tcliente\tresponsavel\tdata\tprioridade\nVídeo institucional\tAcme\tJoão\t2026-08-01\tAlta\nReels tutorial\tAcme\tJoão\t2026-08-03\tMedia';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Criar cards em massa
          </DialogTitle>
          <DialogDescription>
            Cole linhas do Excel/Google Sheets (Ctrl+C direto da planilha) ou CSV. Uma tarefa por linha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="font-medium mb-1">Colunas aceitas (na 1ª linha):</p>
            <div className="flex flex-wrap gap-1.5">
              {HEADERS_HELP.map(h => (
                <span key={h} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{h}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cliente padrão (se linha vier sem)</Label>
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Cole seus dados aqui</Label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
                  1ª linha é cabeçalho
                </label>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setRaw(example)}
                >
                  Usar exemplo
                </button>
              </div>
            </div>
            <Textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={example}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          {parsed.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} válidas</span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {invalidRows.length} com erro</span>
                  )}
                </div>
                <span className="text-muted-foreground">Etapa inicial: <strong>{defaultStage}</strong></span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Título</th>
                      <th className="px-2 py-1.5">Cliente</th>
                      <th className="px-2 py-1.5">Resp.</th>
                      <th className="px-2 py-1.5">Data</th>
                      <th className="px-2 py-1.5">Prior.</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r, i) => (
                      <tr key={i} className={r.error ? 'bg-destructive/5' : ''}>
                        <td className="px-2 py-1 truncate max-w-[180px]">{r.title || <em className="text-muted-foreground">vazio</em>}</td>
                        <td className="px-2 py-1 truncate max-w-[120px]">
                          {r.clientId
                            ? activeClients.find(c => c.id === r.clientId)?.companyName
                            : <span className="text-muted-foreground">{r.clientName || '—'}</span>}
                        </td>
                        <td className="px-2 py-1 truncate max-w-[100px]">{r.assignee || '—'}</td>
                        <td className="px-2 py-1">{r.dueDate || '—'}</td>
                        <td className="px-2 py-1">{r.priority}</td>
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!validRows.length || importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Criar {validRows.length || ''} card{validRows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
