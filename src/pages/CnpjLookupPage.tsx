import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Search, Loader2, Copy, Building2, MapPin, Phone, Mail, Users, Target, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { NICHES, UFS } from '@/data/cnpjNiches';

interface CnpjResult {
  taxId: string;
  alias?: string | null;
  founded?: string;
  head?: boolean;
  status?: { id: number; text: string };
  company?: {
    name?: string;
    equity?: number;
    nature?: { text?: string };
    size?: { acronym?: string; text?: string };
    simples?: { optant?: boolean; since?: string };
    simei?: { optant?: boolean };
    members?: Array<{ person?: { name?: string; age?: string }; role?: { text?: string } }>;
  };
  address?: {
    street?: string; number?: string; details?: string; district?: string;
    city?: string; state?: string; zip?: string;
  };
  phones?: Array<{ type?: string; area?: string; number?: string }>;
  emails?: Array<{ address?: string; ownership?: string }>;
  mainActivity?: { id?: number; text?: string };
  sideActivities?: Array<{ id?: number; text?: string }>;
}

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatPhone = (p: { area?: string; number?: string }) =>
  `(${p.area ?? ''}) ${p.number ?? ''}`.trim();

const money = (n?: number) =>
  typeof n === 'number'
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

const buildNotes = (d: CnpjResult) =>
  [
    `CNPJ: ${formatCnpj(d.taxId)}`,
    d.mainActivity?.text ? `CNAE: ${d.mainActivity.text}` : '',
    d.address?.city ? `Cidade: ${d.address.city}/${d.address.state ?? ''}` : '',
    d.company?.size?.text ? `Porte: ${d.company.size.text}` : '',
    (d.company?.members ?? []).length
      ? `Sócios: ${(d.company!.members ?? []).map((m) => m.person?.name).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

export default function CnpjLookupPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CnpjResult | null>(null);
  const [tab, setTab] = useState('cnpj');

  // filtros de busca por nicho
  const [niches, setNiches] = useState<string[]>([]);
  const [uf, setUf] = useState<string>('');
  const [city, setCity] = useState('');
  const [withPhone, setWithPhone] = useState(true);
  const [withEmail, setWithEmail] = useState(false);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CnpjResult[]>([]);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const lookup = async (value?: string) => {
    const digits = (value ?? input).replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('Digite um CNPJ com 14 dígitos.');
      return;
    }
    setLoading(true);
    setData(null);
    setTab('cnpj');
    setInput(formatCnpj(digits));
    try {
      const { data: res, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { mode: 'lookup', taxId: digits },
      });
      if (error) throw new Error((res as any)?.error || error.message);
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as CnpjResult);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível consultar este CNPJ.');
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (nextPage = 1) => {
    const cnaes = niches.flatMap((label) => NICHES.find((n) => n.label === label)?.cnaes ?? []);
    if (!cnaes.length && !uf && !city.trim()) {
      toast.error('Escolha um nicho ou uma localização.');
      return;
    }
    setSearching(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: {
          mode: 'search',
          cnaes,
          state: uf,
          cities: city.trim() ? [city.trim()] : [],
          withPhone,
          withEmail,
          limit: 20,
          page: nextPage,
        },
      });
      if (error) throw new Error((res as any)?.error || error.message);
      if ((res as any)?.error) throw new Error((res as any).error);
      setResults(((res as any)?.records ?? []) as CnpjResult[]);
      setTotal(Number((res as any)?.count ?? 0));
      setPage(nextPage);
    } catch (e: any) {
      toast.error(e.message || 'Erro na busca.');
    } finally {
      setSearching(false);
    }
  };

  const toggleNiche = (label: string) =>
    setNiches((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const copyAll = () => {
    if (!data) return;
    const lines = [
      `Empresa: ${data.company?.name ?? ''}`,
      data.alias ? `Nome fantasia: ${data.alias}` : '',
      `CNPJ: ${formatCnpj(data.taxId)}`,
      `Situação: ${data.status?.text ?? ''}`,
      `Abertura: ${data.founded ?? ''}`,
      `Atividade: ${data.mainActivity?.text ?? ''}`,
      `Endereço: ${[data.address?.street, data.address?.number, data.address?.district, data.address?.city, data.address?.state].filter(Boolean).join(', ')}`,
      `Telefones: ${(data.phones ?? []).map(formatPhone).join(' / ')}`,
      `E-mails: ${(data.emails ?? []).map((e) => e.address).join(' / ')}`,
      `Sócios: ${(data.company?.members ?? []).map((m) => `${m.person?.name} (${m.role?.text})`).join(' / ')}`,
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Dados copiados.');
  };

  const saveLead = async (d: CnpjResult) => {
    const phone = d.phones?.[0] ? formatPhone(d.phones[0]) : '';
    const { error } = await supabase.from('leads').insert({
      name: d.company?.members?.[0]?.person?.name || d.alias || d.company?.name || 'Lead CNPJ',
      company: d.company?.name ?? '',
      email: d.emails?.[0]?.address ?? '',
      phone,
      source: 'Consulta CNPJ',
      stage: 'Lead novo',
      notes: buildNotes(d),
      estimated_value: 0,
    } as any);
    if (error) throw error;
  };

  const sendToCrm = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await saveLead(data);
      toast.success('Lead criado no CRM.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para o CRM.');
    } finally {
      setSaving(false);
    }
  };

  const sendResultToCrm = async (d: CnpjResult) => {
    setSavingId(d.taxId);
    try {
      await saveLead(d);
      toast.success(`${d.company?.name ?? 'Lead'} enviado ao CRM.`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para o CRM.');
    } finally {
      setSavingId(null);
    }
  };

  const sendAllToCrm = async () => {
    if (!results.length) return;
    setSavingId('all');
    let ok = 0;
    for (const r of results) {
      try { await saveLead(r); ok++; } catch { /* ignore */ }
    }
    setSavingId(null);
    toast.success(`${ok} lead(s) enviados ao CRM.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consulta de CNPJ</h1>
        <p className="text-sm text-muted-foreground">
          Dados oficiais da Receita Federal e prospecção por nicho e localização.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cnpj">Por CNPJ</TabsTrigger>
          <TabsTrigger value="nicho">Por nicho e localização</TabsTrigger>
        </TabsList>

        <TabsContent value="cnpj" className="space-y-4 pt-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
              <Input
                value={input}
                onChange={(e) => setInput(formatCnpj(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="00.000.000/0000-00"
                className="sm:max-w-xs"
              />
              <Button onClick={() => lookup()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Consultar
              </Button>
            </CardContent>
          </Card>

          {data && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {data.company?.name}
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatCnpj(data.taxId)}</Badge>
                      {data.status?.text && (
                        <Badge variant={data.status.id === 2 ? 'default' : 'destructive'}>{data.status.text}</Badge>
                      )}
                      {data.alias && <Badge variant="secondary">{data.alias}</Badge>}
                      {data.head !== undefined && <Badge variant="secondary">{data.head ? 'Matriz' : 'Filial'}</Badge>}
                      {data.company?.simples?.optant && <Badge variant="secondary">Simples Nacional</Badge>}
                      {data.company?.simei?.optant && <Badge variant="secondary">MEI</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyAll}>
                      <Copy className="mr-2 h-4 w-4" /> Copiar
                    </Button>
                    <Button size="sm" onClick={sendToCrm} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                      Enviar para CRM
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Info label="Abertura" value={data.founded} />
                  <Info label="Natureza jurídica" value={data.company?.nature?.text} />
                  <Info label="Porte" value={data.company?.size?.text} />
                  <Info label="Capital social" value={money(data.company?.equity)} />
                  <Info label="Atividade principal" value={data.mainActivity?.text} />
                  <Info label="Optante Simples desde" value={data.company?.simples?.since} />
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Endereço</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>{[data.address?.street, data.address?.number, data.address?.details].filter(Boolean).join(', ')}</p>
                    <p>{[data.address?.district, data.address?.city, data.address?.state].filter(Boolean).join(' - ')}</p>
                    <p>{data.address?.zip ? `CEP ${data.address.zip}` : ''}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4" /> Contato</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(data.phones ?? []).length === 0 && <p className="text-muted-foreground">Sem telefones cadastrados.</p>}
                    {(data.phones ?? []).map((p, i) => {
                      const digits = `55${p.area ?? ''}${p.number ?? ''}`.replace(/\D/g, '');
                      return (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span>{formatPhone(p)}</span>
                          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            WhatsApp
                          </a>
                        </div>
                      );
                    })}
                    {(data.emails ?? []).map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <a href={`mailto:${e.address}`} className="hover:underline">{e.address}</a>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Quadro societário</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(data.company?.members ?? []).length === 0 && <p className="text-muted-foreground">Sem sócios listados.</p>}
                    {(data.company?.members ?? []).map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 border-b border-border pb-1 last:border-0">
                        <span>{m.person?.name}</span>
                        <span className="text-xs text-muted-foreground">{m.role?.text}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Atividades secundárias</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {(data.sideActivities ?? []).length === 0 && <p>Nenhuma.</p>}
                    {(data.sideActivities ?? []).map((a, i) => <p key={i}>{a.text}</p>)}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="nicho" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Nichos</p>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n.label}
                      type="button"
                      onClick={() => toggleNiche(n.label)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        niches.includes(n.label)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <Select value={uf || 'all'} onValueChange={(v) => setUf(v === 'all' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {UFS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Cidade</p>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
                    placeholder="Ex.: Belo Horizonte"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="withPhone" checked={withPhone} onCheckedChange={(v) => setWithPhone(!!v)} />
                  <Label htmlFor="withPhone" className="text-sm font-normal">Somente com telefone</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="withEmail" checked={withEmail} onCheckedChange={(v) => setWithEmail(!!v)} />
                  <Label htmlFor="withEmail" className="text-sm font-normal">Somente com e-mail</Label>
                </div>
                <Button onClick={() => runSearch(1)} disabled={searching} className="ml-auto">
                  {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Buscar empresas
                </Button>
              </div>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {total ? `${total} empresa(s) encontradas` : `${results.length} resultado(s)`}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={sendAllToCrm} disabled={savingId === 'all'}>
                  {savingId === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                  Enviar página ao CRM
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.map((r) => {
                  const p = r.phones?.[0];
                  const waDigits = p ? `55${p.area ?? ''}${p.number ?? ''}`.replace(/\D/g, '') : '';
                  return (
                    <div key={r.taxId} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.alias || r.company?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatCnpj(r.taxId)}
                          {r.address?.city ? ` · ${r.address.city}/${r.address.state ?? ''}` : ''}
                          {r.mainActivity?.text ? ` · ${r.mainActivity.text}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[p ? formatPhone(p) : '', r.emails?.[0]?.address].filter(Boolean).join(' · ') || 'Sem contato'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {waDigits && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => lookup(r.taxId)}>Detalhes</Button>
                        <Button size="sm" onClick={() => sendResultToCrm(r)} disabled={savingId === r.taxId}>
                          {savingId === r.taxId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'CRM'}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || searching} onClick={() => runSearch(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">Página {page}</span>
                  <Button size="sm" variant="outline" disabled={results.length < 20 || searching} onClick={() => runSearch(page + 1)}>
                    Próxima <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
