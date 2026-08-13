import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, FileText, Shield, Hash, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotification } from '@/hooks/usePushNotification';
import logoInova from '@/assets/logo-inova.png';

interface Deliverable {
  label: string;
  quantity: string;
}

interface Contract {
  id: string;
  title: string;
  contractor_name: string;
  contractor_cpf_cnpj: string;
  contractor_address: string;
  client_company?: string;
  client_name: string;
  client_cpf_cnpj: string;
  client_email: string;
  client_address: string;
  services: string;
  scope_description: string;
  monthly_value: number;
  duration_months: number;
  payment_due_day: number;
  additional_clauses: string;
  plan_name: string;
  deliverables: Deliverable[];
  status: string;
  created_at: string;
}

interface Signature {
  signer_name: string;
  signer_cpf: string;
  signer_email: string;
  ip_address: string;
  signed_at: string;
  signature_hash: string;
}

// Generate SHA-256 hash from signature data
async function generateSignatureHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ContractSignPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const { triggerNotification } = usePushNotification();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [existingSignature, setExistingSignature] = useState<Signature | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signatureHash, setSignatureHash] = useState('');

  // Form
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!contractId) return;
    loadContract();
  }, [contractId]);

  const loadContract = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      console.log('Fetching contract:', contractId);
      const { data: c, error: cErr } = await (supabase as any).rpc('get_public_contract', { _id: contractId });

      if (cErr) {
        console.error('Supabase error loading contract:', cErr);
        toast.error('Erro ao carregar contrato do servidor');
      }

      const contractRow = Array.isArray(c) ? c[0] : c;
      if (contractRow) {
        console.log('Contract loaded:', contractRow.title);
        setContract({
          ...contractRow,
          deliverables: Array.isArray(contractRow.deliverables) ? contractRow.deliverables as unknown as Deliverable[] : [],
        } as unknown as Contract);
        setSignerName(contractRow.client_name || '');
        setSignerEmail(contractRow.client_email || '');
      } else {
        console.warn('No contract data returned for ID:', contractId);
      }

      const { data: sigs, error: sErr } = await (supabase as any).rpc('get_contract_signature_minimal', { _contract_id: contractId });
      if (sErr) console.error('Error checking signatures:', sErr);

      const sigRow = Array.isArray(sigs) ? sigs[0] : sigs;
      if (sigRow) {
        console.log('Contract already signed');
        setAlreadySigned(true);
        setExistingSignature(sigRow as Signature);
      }
    } catch (err) {
      console.error('Crash in loadContract:', err);
      toast.error('Erro crítico ao carregar página');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const handleSign = async () => {
    if (!signerName.trim() || !signerCpf.trim() || !signerEmail.trim()) {
      toast.error('Preencha todos os campos obrigatórios'); return;
    }
    if (!accepted) {
      toast.error('Você precisa aceitar os termos do contrato'); return;
    }

    setSigning(true);
    try {
      let ip = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip || '';
      } catch { ip = 'não disponível'; }

      const now = new Date().toISOString();
      const hashInput = `${contractId}|${signerName.trim()}|${signerCpf.trim()}|${signerEmail.trim()}|${ip}|${navigator.userAgent}|${now}`;
      const hash = await generateSignatureHash(hashInput);

      const { error } = await supabase.from('contract_signatures').insert({
        contract_id: contractId,
        signer_name: signerName.trim(),
        signer_cpf: signerCpf.trim(),
        signer_email: signerEmail.trim(),
        ip_address: ip,
        user_agent: navigator.userAgent,
        accepted: true,
        signature_hash: hash,
      });

      if (error) {
        console.error('Error inserting signature:', error);
        throw error;
      }

      // Optimistic update
      setContract(prev => prev ? { ...prev, status: 'assinado' } : null);

      // Update contract status via secure RPC
      const { error: updateErr } = await (supabase as any).rpc('mark_contract_signed', { _id: contractId });
      if (updateErr) console.warn('Status update failed:', updateErr);

      // Send WhatsApp notification (client auto-creation is now guaranteed by DB trigger)
      try {
        await supabase.functions.invoke('notify-contract-signed', {
          body: { contract_id: contractId, signer_name: signerName.trim() },
        });
      } catch (notifErr) {
        console.warn('WhatsApp notification failed:', notifErr);
      }

      setSignatureHash(hash);
      setSigned(true);
      
      // Celebration!
      try {
        triggerNotification(
          "Contrato Assinado! 🏆", 
          `${signerName}, seu contrato foi registrado com sucesso.`, 
          "success", 
          "sale"
        );
      } catch (e) { console.error('Notification error:', e); }
      
      toast.success('Contrato assinado com sucesso!');
    } catch (err: any) {
      console.error('Error in handleSign:', err);
      toast.error(`Erro ao assinar o contrato: ${err?.message || 'Tente novamente'}`);
    }
    setSigning(false);
  };

  const formatDate = (d?: string) => {
    const date = d ? new Date(d) : new Date();
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copiado!');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Carregando Contrato...</h2>
        <p className="text-gray-400 text-sm max-w-xs mb-8">
          Se a página não carregar em alguns segundos, tente o botão abaixo.
        </p>
        <Button 
          variant="outline" 
          onClick={handleManualRefresh}
          className="border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900"
        >
          Forçar Recarregamento
        </Button>
      </div>
    );
  }

  if (!contract || !['enviado', 'assinado'].includes(contract.status)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="text-center">
          <FileText className="mx-auto h-16 w-16 text-gray-800 mb-6" />
          <h1 className="text-white text-xl font-bold mb-2">Contrato Indisponível</h1>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto">
            Este contrato não foi encontrado ou não está mais disponível para assinatura.
          </p>
          <Button onClick={handleManualRefresh} variant="secondary" className="w-full">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Signed state (either just signed or already signed before)
  if (signed || alreadySigned) {
    const displayHash = signatureHash || existingSignature?.signature_hash || '';
    const displayName = signed ? signerName : existingSignature?.signer_name || '';
    const displayDate = signed ? formatDate() : existingSignature?.signed_at ? formatDate(existingSignature.signed_at) : formatDate();

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 px-4">
        <div className="text-center space-y-5 p-8 max-w-lg">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold text-gray-900">Contrato Assinado!</h1>
          <p className="text-gray-600">
            O contrato foi assinado digitalmente com sucesso. Todos os dados da assinatura foram registrados para fins de validade jurídica.
          </p>
          <div className="rounded-lg bg-white p-5 text-left text-sm text-gray-600 shadow-sm space-y-2">
            <p><strong className="text-gray-900">Documento:</strong> {contract.title}</p>
            <p><strong className="text-gray-900">Assinante:</strong> {displayName}</p>
            <p><strong className="text-gray-900">Data:</strong> {displayDate}</p>
            {displayHash && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Hash className="h-3 w-3" /> Hash de verificação (SHA-256)</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-500 bg-gray-50 rounded px-2 py-1 break-all flex-1">
                    {displayHash}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyHash(displayHash)}>
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* PIX Payment - only after signing */}
          <div className="rounded-lg bg-white border border-green-200 p-5 text-left shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              💰 Dados para Pagamento via PIX
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Chave PIX (CNPJ):</strong></p>
              <div className="flex items-center gap-2">
                <code className="rounded bg-gray-50 px-3 py-1.5 text-base font-mono font-bold text-gray-900 border border-green-200">
                  43.908.147/0001-97
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-green-700 hover:bg-green-100"
                  onClick={() => { navigator.clipboard.writeText('43908147000197'); toast.success('Chave PIX copiada!'); }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
              <p className="text-gray-600 mt-2">Após o pagamento, envie o comprovante pelo WhatsApp:</p>
              <a
                href="https://api.whatsapp.com/send/?phone=5502481474167&text=Ol%C3%A1%2C%20segue%20o%20comprovante%20de%20pagamento%20do%20contrato."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 mt-1"
              >
                📲 Enviar comprovante no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const deliverables: Deliverable[] = contract.deliverables || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <img src={logoInova} alt="INOVA Co." className="h-8" />
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Shield className="h-3.5 w-3.5" /> Documento digital seguro
          </div>
        </div>

        {/* Contract Body */}
        <Card className="border-gray-200 shadow-lg bg-white">
          <CardContent className="p-8 sm:p-12">
            <h1 className="text-center text-xl font-bold text-gray-900 mb-8 uppercase tracking-wide">
              {contract.title}
            </h1>

            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>Pelo presente instrumento particular de prestação de serviços, de um lado:</p>

              <div className="rounded-lg bg-gray-50 p-4 not-prose">
                <p className="text-sm font-semibold text-gray-900">CONTRATANTE (Cliente):</p>
                <p className="text-sm text-gray-600">{contract.client_company || contract.client_name}</p>
                {contract.client_company && contract.client_name && <p className="text-sm text-gray-600">Responsável: {contract.client_name}</p>}
                {contract.client_cpf_cnpj && <p className="text-sm text-gray-600">CPF/CNPJ: {contract.client_cpf_cnpj}</p>}
                {contract.client_email && <p className="text-sm text-gray-600">Email: {contract.client_email}</p>}
                {contract.client_address && <p className="text-sm text-gray-600">Endereço: {contract.client_address}</p>}
              </div>

              <div className="rounded-lg bg-gray-50 p-4 not-prose">
                <p className="text-sm font-semibold text-gray-900">CONTRATADO (Prestador):</p>
                <p className="text-sm text-gray-600">{contract.contractor_name}</p>
                {contract.contractor_cpf_cnpj && <p className="text-sm text-gray-600">CPF/CNPJ: {contract.contractor_cpf_cnpj}</p>}
                {contract.contractor_address && <p className="text-sm text-gray-600">Endereço: {contract.contractor_address}</p>}
              </div>

              <p>Têm entre si justo e contratado o seguinte:</p>

              <h3 className="font-bold text-gray-900">CLÁUSULA 1ª - DO OBJETO</h3>
              <p>O presente contrato tem por objeto a prestação dos seguintes serviços: <strong>{contract.services}</strong>.</p>
              {contract.scope_description && <p>Escopo detalhado: {contract.scope_description}</p>}

              {/* Plan Deliverables */}
              {(contract.plan_name || deliverables.length > 0) && (
                <>
                  <h3 className="font-bold text-gray-900">CLÁUSULA 2ª - DAS ENTREGAS</h3>
                  {contract.plan_name && (
                    <p>O plano contratado é o <strong>{contract.plan_name}</strong>, que inclui:</p>
                  )}
                  {deliverables.length > 0 && (
                    <div className="rounded-lg border border-gray-200 overflow-hidden not-prose">
                      <table className="w-full text-sm">
                        <tbody>
                          {deliverables.map((d, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 w-20 text-center border-r border-gray-100">{d.quantity}</td>
                              <td className="px-4 py-2.5 text-gray-700">{d.label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              <h3 className="font-bold text-gray-900">{deliverables.length > 0 ? 'CLÁUSULA 3ª' : 'CLÁUSULA 2ª'} - DO VALOR E PAGAMENTO</h3>
              <p>
                O CONTRATANTE pagará ao CONTRATADO o valor mensal de{' '}
                <strong>R$ {Number(contract.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
                (reais), com vencimento todo dia <strong>{contract.payment_due_day}</strong> de cada mês.
              </p>

              <h3 className="font-bold text-gray-900">{deliverables.length > 0 ? 'CLÁUSULA 4ª' : 'CLÁUSULA 3ª'} - DO PRAZO E CARÊNCIA</h3>
              <p>
                O presente contrato terá prazo mínimo de permanência de <strong>{contract.duration_months} meses</strong>, contados a partir da data de assinatura.
              </p>
              <p>
                Após este período, o contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.
              </p>

              <h3 className="font-bold text-gray-900">{deliverables.length > 0 ? 'CLÁUSULA 5ª' : 'CLÁUSULA 4ª'} - DA RESCISÃO ANTECIPADA</h3>
              <p>
                Caso o CONTRATANTE solicite o cancelamento antes do prazo mínimo de permanência, será aplicada multa rescisória correspondente a 30% do valor restante do contrato, a título de compensação pelos serviços contratados e planejamento realizado.
              </p>

              <h3 className="font-bold text-gray-900">{deliverables.length > 0 ? 'CLÁUSULA 6ª' : 'CLÁUSULA 5ª'} - RESPONSABILIDADE DO CLIENTE</h3>
              <p>
                Caso o CONTRATANTE não disponibilize agenda para captação de conteúdo ou não envie materiais necessários para produção dentro do mês vigente, as entregas poderão ser reajustadas ou reagendadas conforme disponibilidade da equipe, sem obrigação de compensação de entregas acumuladas.
              </p>

              <h3 className="font-bold text-gray-900">{deliverables.length > 0 ? 'CLÁUSULA 7ª' : 'CLÁUSULA 6ª'} - DO SIGILO</h3>
              <p>
                As partes se comprometem a manter sigilo sobre todas as informações confidenciais compartilhadas durante a
                vigência deste contrato e por um período de 2 (dois) anos após seu término.
              </p>

              {contract.additional_clauses && (
                <>
                  <h3 className="font-bold text-gray-900">CLÁUSULAS ADICIONAIS</h3>
                  <div className="whitespace-pre-wrap">{contract.additional_clauses}</div>
                </>
              )}

              <h3 className="font-bold text-gray-900">CLÁUSULA FINAL - DA ASSINATURA DIGITAL</h3>
              <p>
                As partes declaram que a assinatura digital realizada nesta plataforma tem plena validade jurídica,
                conforme o disposto no Código Civil Brasileiro (artigos 104, 107 e 221) e na Medida Provisória nº 2.200-2/2001.
                A identificação do signatário é feita por meio de nome completo, CPF, email verificado, endereço IP,
                data/hora da assinatura e hash criptográfico SHA-256 único e intransferível.
              </p>

              <p className="text-center text-gray-500 mt-8">{formatDate()}</p>
            </div>

            <div className="mt-10 border-t border-gray-200 pt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" /> Assinatura Digital
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-gray-700">Nome completo *</Label>
                    <Input value={signerName} onChange={e => setSignerName(e.target.value)} className="bg-white border-gray-300 text-gray-900" />
                  </div>
                  <div>
                    <Label className="text-gray-700">CPF *</Label>
                    <Input value={signerCpf} onChange={e => setSignerCpf(e.target.value)} placeholder="000.000.000-00" className="bg-white border-gray-300 text-gray-900" />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700">Email *</Label>
                  <Input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} className="bg-white border-gray-300 text-gray-900" />
                </div>

                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                  <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="mt-0.5" />
                  <span className="text-sm text-gray-600 leading-relaxed">
                    Declaro que li e concordo com todos os termos e condições deste contrato. Reconheço que esta assinatura digital
                    tem validade jurídica e que meus dados (nome, CPF, email, IP, data/hora) serão registrados juntamente com um hash
                    criptográfico SHA-256 único e intransferível como prova de consentimento.
                  </span>
                </label>

                <Button onClick={handleSign} disabled={signing || !accepted} className="w-full h-12 text-base" size="lg">
                  {signing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Assinando...</> : <>✍️ Assinar Contrato</>}
                </Button>

                <p className="text-center text-xs text-gray-400">
                  Ao assinar, será gerado um hash SHA-256 único com seus dados, IP, navegador e data/hora para fins de validade jurídica.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
