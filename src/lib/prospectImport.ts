import { supabase } from '@/integrations/supabase/client';
import { nicheLabel, phoneKey } from '@/lib/prospectNiche';

/** Empresa vinda de outra tela (ex.: Consulta CNPJ) para a lista da Prospecção Manual */
export type ProspectInput = {
  name: string;
  phones: string | null | undefined;
  address?: string | null;
  website?: string | null;
  instagram?: string | null;
};

const PROSPECTS = 'prospects' as never;

/** Só dígitos, com 55; null quando não é um telefone */
const withCountry = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
};

const isMobile = (full: string) => full.length === 13 && full[4] === '9';

/** Escolhe o melhor número do campo (às vezes vem "(24) 3333-4444 / (24) 99999-8888"): celular primeiro */
export function bestPhone(raw: string | null | undefined) {
  const all = String(raw ?? '').split(/[\/,;|]| e /).map((p) => withCountry(p)).filter(Boolean) as string[];
  return all.find(isMobile) ?? all[0] ?? null;
}

/** Mensagem padrão da Prospecção Manual com o nome da empresa */
function manualMessage(company: string) {
  try {
    const tpl = localStorage.getItem('prospection_message_template') ?? '';
    const agency = localStorage.getItem('prospection_agency_name') || 'INOVA';
    return tpl.replace(/\{agencia\}/gi, agency).replace(/\{empresa\}/gi, company).trim();
  } catch { return ''; }
}

/**
 * Coloca as empresas na Prospecção Manual (prospects sem campanha) no nicho escolhido.
 * Pula quem não tem telefone e quem já está na prospecção (mesmo número escrito diferente).
 */
export async function addToManualProspecting(items: ProspectInput[], niche: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Entre na plataforma para enviar as empresas para a prospecção.');

  const { data: existing, error: readErr } = await supabase.from(PROSPECTS).select('phone').not('phone', 'is', null);
  if (readErr) throw readErr;
  const taken = new Set(((existing ?? []) as unknown as { phone: string }[]).map((r) => phoneKey(r.phone)).filter(Boolean));

  const category = nicheLabel(niche);
  const rows: Record<string, unknown>[] = [];
  const repeated: string[] = [];
  let noPhone = 0;
  for (const it of items) {
    const phone = bestPhone(it.phones);
    if (!phone) { noPhone++; continue; }
    const key = phoneKey(phone)!;
    if (taken.has(key)) { repeated.push(it.name); continue; }
    taken.add(key);
    rows.push({
      id: crypto.randomUUID(), campaign_id: null, name: it.name, phone, address: it.address || '', category,
      rating: null, website: it.website || '', instagram: it.instagram || '', message: manualMessage(it.name),
      status: 'novo', created_by: session.user.id,
    });
  }

  let added = 0;
  if (rows.length) {
    const { error } = await supabase.from(PROSPECTS).insert(rows as never);
    if (!error) added = rows.length;
    else {
      // Alguma já entrou por outro caminho: tenta uma a uma
      for (let i = 0; i < rows.length; i += 10) {
        const res = await Promise.all(rows.slice(i, i + 10).map((r) => supabase.from(PROSPECTS).insert(r as never)));
        res.forEach((r, j) => {
          if (!r.error) added++;
          else if (r.error.code === '23505') repeated.push(String(rows[i + j].name));
          else throw r.error;
        });
      }
    }
  }
  return { added, repeated, noPhone, category };
}
