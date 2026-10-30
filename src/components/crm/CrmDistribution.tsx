import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Seller = { profile_id: string; active: boolean; last_assigned_at: string | null };
type Profile = { id: string; full_name: string; job_title: string | null };

const SELLERS = 'crm_sellers' as never;
const CAPTURE_URL = 'https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/crm-capture';

/** Distribuição de leads (rodízio entre vendedores) e como capturar leads de formulários */
export function CrmDistribution() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sellers, setSellers] = useState<Record<string, Seller>>({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: s, error }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, job_title').eq('is_active', true).not('username', 'is', null).not('full_name', 'is', null).order('full_name'),
      supabase.from(SELLERS).select('*'),
    ]);
    setMissing(!!error);
    setProfiles(((p ?? []) as Profile[]).filter((x) => x.full_name?.trim()));
    setSellers(Object.fromEntries(((s ?? []) as unknown as Seller[]).map((x) => [x.profile_id, x])));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, active: boolean) => {
    setSellers((m) => ({ ...m, [id]: { profile_id: id, active, last_assigned_at: m[id]?.last_assigned_at ?? null } }));
    const { error } = await supabase.from(SELLERS).upsert({ profile_id: id, active } as never);
    if (error) toast.error('Não foi possível salvar');
  };

  if (missing) return <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">A distribuição ainda não está no banco. Peça ao Lovable para aplicar a migração <code>20261030210000_crm_whatsapp.sql</code>.</p>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const active = Object.values(sellers).filter((s) => s.active).length;
  const example = `fetch('${CAPTURE_URL}', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ token: 'SEU_TOKEN', name, phone, email, company, source: 'Site' })\n})`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Rodízio de vendedores</h2>
          <p className="text-sm text-muted-foreground">
            Lead novo (do WhatsApp ou de formulário) vai para o próximo vendedor ativo, em rodízio. Lead que chega no número de um vendedor fica com ele.
            {active === 0 && ' Nenhum vendedor ativo: os leads entram sem dono.'}
          </p>
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.job_title || '—'}
                  {sellers[p.id]?.last_assigned_at && ` · último lead em ${new Date(sellers[p.id].last_assigned_at!).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <Switch checked={!!sellers[p.id]?.active} onCheckedChange={(v) => toggle(p.id, v)} aria-label={`Rodízio: ${p.full_name}`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Captura de leads</h2>
          <p className="text-sm text-muted-foreground">Os leads entram sozinhos no pipeline por três caminhos:</p>
        </div>
        <ol className="list-decimal space-y-3 rounded-xl border bg-card p-4 pl-8 text-sm">
          <li><strong>WhatsApp:</strong> em Automações WhatsApp → Números, ligue "Contato novo vira lead" no número. Quem escrever pela primeira vez vira lead, com a primeira mensagem nas observações.</li>
          <li><strong>Pela conversa:</strong> na aba Conversas, o botão "Virar lead" transforma qualquer contato em lead.</li>
          <li>
            <strong>Formulários do site, quiz e landing pages:</strong> enviam os dados para o endereço abaixo, com o token do segredo <code className="text-xs">CRM_CAPTURE_TOKEN</code> (cadastre no Lovable).
            <div className="mt-2 rounded-lg bg-muted p-2 font-mono text-[11px] leading-relaxed break-all">{CAPTURE_URL}</div>
            <Button size="sm" variant="ghost" className="mt-1 gap-1.5" onClick={() => { navigator.clipboard.writeText(example); toast.success('Exemplo copiado'); }}>
              <Copy className="h-3.5 w-3.5" /> Copiar exemplo de código
            </Button>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">Lead novo também pode entrar sozinho numa sequência de follow-up: ligue "Colocar todo lead novo nesta sequência" na aba Follow-up.</p>
      </section>
    </div>
  );
}
