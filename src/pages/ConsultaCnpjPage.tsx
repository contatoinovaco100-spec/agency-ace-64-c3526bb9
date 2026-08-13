import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Building2, MapPin, Phone, Mail, Calendar, Briefcase, DollarSign, Copy, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';

interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  natureza_juridica: string | null;
  atividade_principal: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  porte: string | null;
  capital_social: string | null;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatCurrency(value: string | null) {
  if (!value) return null;
  const num = parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function formatCep(cep: string | null) {
  if (!cep) return null;
  const d = cep.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return cep;
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  if (!situacao) return null;
  const s = situacao.toUpperCase();
  const isAtiva = s.includes('ATIVA') || s === 'ATIVA';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isAtiva
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isAtiva ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {situacao}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, copyable }: {
  icon: any; label: string; value: string | null; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  function handleCopy() {
    navigator.clipboard.writeText(value!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="mt-0.5 p-1.5 rounded-lg bg-white/5">
        <Icon className="w-3.5 h-3.5 text-[#BFF720]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
        <p className="text-sm text-zinc-100 break-words">{value}</p>
      </div>
      {copyable && (
        <button
          onClick={handleCopy}
          className="mt-0.5 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-500 hover:text-zinc-200"
          title="Copiar"
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function ConsultaCnpjPage() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnpjData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const digits = cnpjInput.replace(/\D/g, '');
    if (digits.length !== 14) {
      setError('Digite um CNPJ válido com 14 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: digits },
      });

      if (fnErr) {
        let detail = fnErr.message;
        try {
          const ctx: any = (fnErr as any).context;
          if (ctx?.json) detail = (await ctx.json()).error || detail;
          else if (ctx?.text) detail = await ctx.text();
        } catch {}
        throw new Error(detail);
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error('Nenhum dado retornado.');

      setResult(data.data);
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar CNPJ. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCnpjInput(formatCnpj(e.target.value));
    if (error) setError(null);
  }

  function buildAddress(d: CnpjData) {
    const parts = [
      d.logradouro,
      d.numero,
      d.complemento,
      d.bairro,
      d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : d.municipio || d.uf,
      formatCep(d.cep),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-[Inter,system-ui,sans-serif]">
      {/* Gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#BFF720]/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-lime-400/3 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#BFF720]/10 border border-[#BFF720]/20 mb-4">
            <Building2 className="w-7 h-7 text-[#BFF720]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
            Consulta de CNPJ
          </h1>
          <p className="text-zinc-400 text-base">
            Pesquise dados completos de qualquer empresa brasileira gratuitamente.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-zinc-500" />
            </div>
            <input
              type="text"
              value={cnpjInput}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className="w-full pl-12 pr-36 py-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-[#BFF720]/50 focus:ring-2 focus:ring-[#BFF720]/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading || cnpjInput.replace(/\D/g, '').length < 14}
              className="absolute right-2 top-2 bottom-2 px-5 bg-[#BFF720] hover:bg-[#d4ff30] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all text-sm flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Buscando...' : 'Consultar'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 hover:text-red-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
            {/* Company header */}
            <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-900/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{result.razao_social}</h2>
                  {result.nome_fantasia && result.nome_fantasia !== result.razao_social && (
                    <p className="text-sm text-zinc-400 mt-0.5">{result.nome_fantasia}</p>
                  )}
                  <p className="text-sm font-mono text-zinc-500 mt-1">{result.cnpj || formatCnpj(cnpjInput)}</p>
                </div>
                <SituacaoBadge situacao={result.situacao_cadastral} />
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-0">
              <InfoRow
                icon={Calendar}
                label="Data de abertura"
                value={result.data_abertura}
              />
              <InfoRow
                icon={Briefcase}
                label="Natureza jurídica"
                value={result.natureza_juridica}
              />
              <InfoRow
                icon={Briefcase}
                label="Atividade principal"
                value={result.atividade_principal}
              />
              <InfoRow
                icon={Building2}
                label="Porte"
                value={result.porte}
              />
              <InfoRow
                icon={DollarSign}
                label="Capital social"
                value={formatCurrency(result.capital_social)}
              />
              <InfoRow
                icon={MapPin}
                label="Endereço"
                value={buildAddress(result)}
                copyable
              />
              <InfoRow
                icon={Phone}
                label="Telefone"
                value={result.telefone}
                copyable
              />
              <InfoRow
                icon={Mail}
                label="E-mail"
                value={result.email}
                copyable
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-zinc-950/50 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 text-center">
                Dados obtidos da Receita Federal via BrasilAPI · Atualização periódica
              </p>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!result && !error && !loading && (
          <div className="text-center text-zinc-600 text-sm mt-4">
            <p>Digite o CNPJ acima para consultar dados da empresa</p>
          </div>
        )}
      </div>
    </div>
  );
}
