import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Loader2, Copy, Building2, MapPin, Phone, Mail, Users, Target } from 'lucide-react';

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

export default function CnpjLookupPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CnpjResult | null>(null);

  const search = async () => {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('Digite um CNPJ com 14 dígitos.');
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { taxId: digits },
      });
      if (error) {
        const msg = (res as any)?.error || error.message;
        throw new Error(msg);
      }
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as CnpjResult);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível consultar este CNPJ.');
    } finally {
      setLoading(false);
    }
  };

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
      `E-mails: ${(data.emails ?? []).map(e => e.address).join(' / ')}`,
      `Sócios: ${(data.company?.members ?? []).map(m => `${m.person?.name} (${m.role?.text})`).join(' / ')}`,
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Dados copiados.');
  };

  const sendToCrm = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const phone = data.phones?.[0] ? formatPhone(data.phones[0]) : '';
      const notes = [
        `CNPJ: ${formatCnpj(data.taxId)}`,
        data.mainActivity?.text ? `CNAE: ${data.mainActivity.text}` : '',
        data.address?.city ? `Cidade: ${data.address.city}/${data.address.state ?? ''}` : '',
        data.company?.size?.text ? `Porte: ${data.company.size.text}` : '',
        (data.company?.members ?? []).length
          ? `Sócios: ${(data.company!.members ?? []).map(m => m.person?.name).join(', ')}`
          : '',
      ].filter(Boolean).join('\n');

      const { error } = await supabase.from('leads').insert({
        name: data.company?.members?.[0]?.person?.name || data.alias || data.company?.name || 'Lead CNPJ',
        company: data.company?.name ?? '',
        email: data.emails?.[0]?.address ?? '',
        phone,
        source: 'Consulta CNPJ',
        stage: 'Lead novo',
        notes,
        estimated_value: 0,
      } as any);
      if (error) throw error;
      toast.success('Lead criado no CRM.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para o CRM.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consulta de CNPJ</h1>
        <p className="text-sm text-muted-foreground">
          Dados oficiais da Receita Federal para prospecção do time comercial.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            value={input}
            onChange={(e) => setInput(formatCnpj(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="00.000.000/0000-00"
            className="sm:max-w-xs"
          />
          <Button onClick={search} disabled={loading}>
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
                      <a
                        href={`https://wa.me/${digits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
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
