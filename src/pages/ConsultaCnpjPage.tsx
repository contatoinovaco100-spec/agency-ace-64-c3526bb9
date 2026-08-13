import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Building2, MapPin, Phone, Mail, Calendar, Briefcase,
  DollarSign, Copy, CheckCircle2, Loader2, AlertCircle, X,
  ChevronRight, ChevronLeft, Filter, Globe, MessageCircle, ExternalLink,
} from 'lucide-react';

const SUPABASE_URL = 'https://coblfehkclfjofrshlwl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvYmxmZWhrY2xmam9mcnNobHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTkzODQsImV4cCI6MjA4OTYzNTM4NH0.Mi4DGSWEtf6sn4NUKOlYws0_DotBgIOVXlZ45SYGQuM';

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  situacao_cadastral?: string | null;
  data_abertura?: string | null;
  natureza_juridica?: string | null;
  atividade_principal?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
  telefone?: string | null;
  porte?: string | null;
  capital_social?: string | null;
}

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatCurrency(v: string | number | null | undefined) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function formatCep(c: string | null) {
  if (!c) return null;
  const d = c.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : c;
}

function buildAddress(d: CnpjData) {
  return [
    d.logradouro,
    d.numero,
    d.complemento,
    d.bairro,
    d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : d.municipio || d.uf,
    formatCep(d.cep ?? null),
  ].filter(Boolean).join(', ') || null;
}

function buildWhatsAppLink(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const phone = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${phone}`;
}

function buildInstagramSearch(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(name + ' Instagram')}`;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SituacaoBadge({ s }: { s?: string | null }) {
  if (!s) return null;
  const active = s.toUpperCase().includes('ATIVA');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0
      ${active
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {s}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button onClick={copy}
      className="ml-1 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors">
      {done
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value, copy }: {
  icon: any; label: string; value?: string | null; copy?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="mt-0.5 p-1.5 rounded-lg bg-white/5 shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#BFF720]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-zinc-500 mb-0.5">{label}</p>
        <p className="text-sm text-zinc-100 break-words">{value}</p>
      </div>
      {copy && <CopyBtn text={value} />}
    </div>
  );
}

function CnpjCard({ d, expanded, onToggle }: {
  d: CnpjData; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden transition-all">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/3 transition-colors"
      >
        <div className="p-2 rounded-lg bg-[#BFF720]/10 border border-[#BFF720]/20 shrink-0 mt-0.5">
          <Building2 className="w-4 h-4 text-[#BFF720]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{d.razao_social}</p>
          {d.nome_fantasia && d.nome_fantasia !== d.razao_social && (
            <p className="text-xs text-zinc-400 truncate">{d.nome_fantasia}</p>
          )}
          <p className="text-xs font-mono text-zinc-500 mt-0.5">{formatCnpj(d.cnpj.replace(/\D/g, ''))}</p>
          {d.atividade_principal && (
            <p className="text-xs text-[#BFF720] mt-1 truncate font-medium">{d.atividade_principal}</p>
          )}
          {d.telefone && (
            <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {d.telefone}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
          <SituacaoBadge s={d.situacao_cadastral} />
          <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <InfoRow icon={MapPin}     label="Endereço"     value={buildAddress(d)} copy />
          <InfoRow icon={Phone}      label="Telefone"     value={d.telefone}      copy />
          <InfoRow icon={Mail}       label="E-mail"       value={d.email}         copy />
          <InfoRow icon={Calendar}   label="Abertura"     value={d.data_abertura} />
          <InfoRow icon={Briefcase}  label="Natureza"     value={d.natureza_juridica} />
          <InfoRow icon={Building2}  label="Porte"        value={d.porte} />
          <InfoRow icon={DollarSign} label="Capital social" value={formatCurrency(d.capital_social)} />

          {/* Social buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            {buildWhatsAppLink(d.telefone) && (
              <a
                href={buildWhatsAppLink(d.telefone)!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}
            <a
              href={buildInstagramSearch(d.nome_fantasia || d.razao_social)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-medium hover:bg-pink-600/30 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Instagram
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6">
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{msg}</p>
      <button onClick={onDismiss} className="hover:text-red-300 transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Tab: Lookup by CNPJ ────────────────────────────────────────────────── */

function LookupTab() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnpjData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 14) { setError('CNPJ deve ter 14 dígitos.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await invokeFunction('consulta-cnpj', { action: 'lookup', cnpj: digits });
      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error('Nenhum dado retornado.');
      setResult(data.data);
      setExpanded(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar CNPJ.');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={search} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text" value={input}
            onChange={e => { setInput(formatCnpj(e.target.value)); setError(null); }}
            placeholder="00.000.000/0000-00" maxLength={18}
            className="w-full pl-12 pr-36 py-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-[#BFF720]/50 focus:ring-2 focus:ring-[#BFF720]/20 transition-all"
          />
          <button type="submit" disabled={loading || input.replace(/\D/g, '').length < 14}
            className="absolute right-2 top-2 bottom-2 px-5 bg-[#BFF720] hover:bg-[#d4ff30] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all text-sm flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Buscando...' : 'Consultar'}
          </button>
        </div>
      </form>

      {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

      {result && (
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-900/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{result.razao_social}</h2>
                {result.nome_fantasia && result.nome_fantasia !== result.razao_social && (
                  <p className="text-sm text-zinc-400 mt-0.5">{result.nome_fantasia}</p>
                )}
                <p className="text-sm font-mono text-zinc-500 mt-1">
                  {formatCnpj((result.cnpj || input).replace(/\D/g, ''))}
                </p>
              </div>
              <SituacaoBadge s={result.situacao_cadastral} />
            </div>
          </div>
          <div className="p-5">
            <InfoRow icon={Calendar}   label="Data de abertura"     value={result.data_abertura} />
            <InfoRow icon={Briefcase}  label="Natureza jurídica"    value={result.natureza_juridica} />
            <InfoRow icon={Briefcase}  label="Atividade principal"  value={result.atividade_principal} />
            <InfoRow icon={Building2}  label="Porte"                value={result.porte} />
            <InfoRow icon={DollarSign} label="Capital social"       value={formatCurrency(result.capital_social)} />
            <InfoRow icon={MapPin}     label="Endereço"             value={buildAddress(result)} copy />
            <InfoRow icon={Phone}      label="Telefone"             value={result.telefone}      copy />
            <InfoRow icon={Mail}       label="E-mail"               value={result.email}         copy />
          </div>
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/40">
            <p className="text-xs text-zinc-600 text-center">Dados da Receita Federal via BrasilAPI</p>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-center text-zinc-600 text-sm mt-4">
          Digite o CNPJ acima para consultar dados da empresa
        </p>
      )}
    </div>
  );
}

/* ─── Tab: Search by location ────────────────────────────────────────────── */

function LocationTab() {
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [activity, setActivity] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CnpjData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [municipioFound, setMunicipioFound] = useState('');
  const [searched, setSearched] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function doSearch(p: number) {
    if (!city.trim() || !uf.trim()) { setError('Informe cidade e estado.'); return; }
    setLoading(true); setError(null);
    try {
      const data = await invokeFunction('consulta-cnpj', {
        action: 'search', city: city.trim(), uf: uf.trim(), activity: activity.trim(), page: p,
      });
      if (data?.error) throw new Error(data.error);
      setResults(data.items || []);
      setTotal(data.total || 0);
      setMunicipioFound(`${data.municipio || city} - ${data.uf || uf}`);
      setPage(p);
      setSearched(true);
      setExpandedId(null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar empresas. Tente novamente.');
    } finally { setLoading(false); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(1);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          {/* City */}
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text" value={city}
              onChange={e => { setCity(e.target.value); setError(null); }}
              placeholder="Cidade (ex.: Fortaleza)"
              className="w-full pl-10 pr-4 py-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#BFF720]/50 focus:ring-2 focus:ring-[#BFF720]/20 transition-all text-sm"
            />
          </div>
          {/* UF select */}
          <select
            value={uf} onChange={e => setUf(e.target.value)}
            className="px-4 py-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-[#BFF720]/50 focus:ring-2 focus:ring-[#BFF720]/20 transition-all text-sm w-24 appearance-none cursor-pointer"
          >
            <option value="">UF</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Activity filter (optional) */}
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text" value={activity}
            onChange={e => setActivity(e.target.value)}
            placeholder="Atividade / CNAE (opcional — ex.: marketing, 7319-0)"
            className="w-full pl-10 pr-4 py-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#BFF720]/50 focus:ring-2 focus:ring-[#BFF720]/20 transition-all text-sm"
          />
        </div>

        <button type="submit" disabled={loading || !city.trim() || !uf.trim()}
          className="w-full py-3.5 bg-[#BFF720] hover:bg-[#d4ff30] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Buscando empresas...' : 'Buscar Empresas'}
        </button>
      </form>

      {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

      {/* Results */}
      <div ref={resultsRef}>
        {searched && !loading && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300 font-medium">
                {municipioFound}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {results.length > 0
                  ? `${results.length} empresa${results.length !== 1 ? 's' : ''} encontrada${results.length !== 1 ? 's' : ''}${total > results.length ? ` (total: ${total})` : ''}`
                  : 'Nenhuma empresa encontrada'}
              </p>
            </div>
            {total > results.length && (
              <span className="text-xs text-zinc-600">Pág. {page}</span>
            )}
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="space-y-2">
              {results.filter(d => d.telefone).map(d => (
                <CnpjCard
                  key={d.cnpj}
                  d={d}
                  expanded={expandedId === d.cnpj}
                  onToggle={() => setExpandedId(prev => prev === d.cnpj ? null : d.cnpj)}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => doSearch(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm disabled:opacity-40 hover:border-zinc-700 transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-zinc-500 text-sm">Página {page}</span>
              <button
                onClick={() => doSearch(page + 1)}
                disabled={loading || results.length < 20}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm disabled:opacity-40 hover:border-zinc-700 transition-all"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma empresa ativa encontrada nessa localização.</p>
            <p className="text-xs mt-1 opacity-70">Tente ajustar o nome da cidade ou o estado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

type TabKey = 'cnpj' | 'location';

export default function ConsultaCnpjPage() {
  const [tab, setTab] = useState<TabKey>('cnpj');

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-[Inter,system-ui,sans-serif]">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#BFF720]/5 blur-[120px]" />
        <div className="absolute -bottom-60 -right-60 w-[700px] h-[700px] rounded-full bg-lime-400/3 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#BFF720]/10 border border-[#BFF720]/20 mb-4 shadow-[0_0_30px_rgba(191,247,32,0.15)]">
            <Building2 className="w-7 h-7 text-[#BFF720]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
            Consulta de CNPJ
          </h1>
          <p className="text-zinc-400 text-base max-w-md mx-auto">
            Pesquise qualquer empresa brasileira por CNPJ ou explore empresas por localização.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900/60 border border-zinc-800 rounded-2xl p-1 mb-8 gap-1">
          {([
            { key: 'cnpj' as TabKey,     icon: Search,   label: 'Buscar por CNPJ' },
            { key: 'location' as TabKey, icon: Globe,     label: 'Buscar por Localização' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === key
                  ? 'bg-[#BFF720] text-black shadow-[0_0_20px_rgba(191,247,32,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'cnpj'     && <LookupTab />}
        {tab === 'location' && <LocationTab />}

        {/* Powered by note */}
        <p className="text-center text-xs text-zinc-700 mt-10">
          Dados da Receita Federal via BrasilAPI &amp; CNPJ.ws · Atualização periódica
        </p>
      </div>
    </div>
  );
}
