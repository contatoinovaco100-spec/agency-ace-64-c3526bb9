import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const WEBHOOK_URL = `https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/wa-webhook`;

export default function WhatsAppConfigPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('wa-config-test');
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast({ title: 'URL copiada!' });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-heading font-semibold text-foreground">Configuração WhatsApp</h1>
        <p className="text-body text-muted-foreground">
          Teste a conexão e configure o webhook no Meta
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">1. Testar conexão</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Verifica se o token e o Phone Number ID estão corretos.
          </p>
          <Button onClick={runTest} disabled={testing} className="gap-2">
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Testar agora
          </Button>
        </div>

        {result && (
          <div
            className={`rounded-lg border p-4 ${
              result.ok ? 'border-success/50 bg-success/10' : 'border-destructive/50 bg-destructive/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                {result.ok ? (
                  <>
                    <p className="font-semibold text-success">Conectado com sucesso!</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Número:</span> {result.phone_number}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Nome verificado:</span>{' '}
                      {result.verified_name || '—'}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Qualidade:</span>{' '}
                      {result.quality_rating || '—'}
                    </p>
                    {!result.business_id_configured && (
                      <p className="text-sm text-warning mt-2">
                        ⚠ WhatsApp Business Account ID não configurado (opcional, usado pra
                        sincronizar templates)
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-destructive">Falhou</p>
                    <p className="text-sm">{result.error}</p>
                    {result.missing && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        Faltando: {Object.entries(result.missing).filter(([, v]) => v).map(([k]) => k).join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">2. Configurar webhook no Meta</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Pra receber mensagens, cole esses dados no painel do Meta:
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Callback URL</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 rounded bg-secondary px-3 py-2 text-sm font-mono break-all">
                {WEBHOOK_URL}
              </code>
              <Button size="icon" variant="outline" onClick={copyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Verify Token</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 rounded bg-secondary px-3 py-2 text-sm font-mono">
                Use o valor que você cadastrou em META_WA_VERIFY_TOKEN
              </code>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Eventos a assinar</label>
            <p className="text-sm mt-1">Marque apenas: <strong>messages</strong></p>
          </div>
        </div>

        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Abrir Meta for Developers <ExternalLink className="h-3 w-3" />
        </a>

        <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-2">Passo a passo no Meta:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Abra seu app no Meta for Developers</li>
            <li>Menu lateral → WhatsApp → Configuração</li>
            <li>Seção "Webhook" → clique em "Editar"</li>
            <li>Cole a Callback URL e o Verify Token</li>
            <li>Clique em "Verificar e salvar"</li>
            <li>Em "Campos do webhook" assine <strong>messages</strong></li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
