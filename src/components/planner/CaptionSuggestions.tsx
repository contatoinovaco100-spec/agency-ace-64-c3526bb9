import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type PostContext = {
  id: string; client_id: string | null; title: string; task_type: string; platform: string; format: string;
  description: string; full_script: string; video_idea: string; observations: string;
};

const clip = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n);

/** Monta o contexto do cliente: briefing (tom, público, o que evitar) e legendas já usadas, para manter a voz da marca */
async function clientContext(clientId: string | null, currentId: string) {
  if (!clientId) return { name: '', briefing: '', examples: [] as string[] };
  const [{ data: client }, { data: briefing }, { data: past }] = await Promise.all([
    supabase.from('clients').select('company_name, scope').eq('id', clientId).maybeSingle(),
    supabase.from('client_briefings').select('segment, communication_style, things_to_avoid, desired_perception, audience_desires, differentials')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('tasks').select('caption').eq('client_id', clientId).neq('id', currentId)
      .not('caption', 'is', null).order('post_date', { ascending: false }).limit(15),
  ]);
  const b = briefing as Record<string, string> | null;
  return {
    name: client?.company_name ?? '',
    briefing: b ? [
      b.segment && `Segmento: ${b.segment}`,
      b.communication_style && `Tom de voz: ${b.communication_style}`,
      b.desired_perception && `Como quer ser visto: ${b.desired_perception}`,
      b.audience_desires && `O que o público deseja: ${b.audience_desires}`,
      b.differentials && `Diferenciais: ${b.differentials}`,
      b.things_to_avoid && `Evitar: ${b.things_to_avoid}`,
    ].filter(Boolean).join('\n') : '',
    // Só legendas de verdade (marcadores como "-" ficam de fora)
    examples: ((past ?? []) as { caption: string }[]).map((p) => p.caption).filter((c) => /[\p{L}]{20,}/u.test(c)).slice(0, 4),
  };
}

/** Botão "Sugerir legenda": gera 3 opções no tom do cliente; clicar em uma coloca no campo de legenda */
export function CaptionSuggestions({ post, onPick }: { post: PostContext; onPick: (caption: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);

  const generate = async () => {
    setLoading(true);
    try {
      const ctx = await clientContext(post.client_id, post.id);
      const systemPrompt = `Você é social media sênior de uma agência brasileira. Escreve legendas de Instagram em português do Brasil,
naturais, sem clichês de IA, no tom da marca. Cada legenda: gancho forte na primeira linha, corpo curto, chamada para ação
e de 3 a 6 hashtags relevantes no final. Máximo de 1.200 caracteres. Use emojis com moderação, só se combinarem com o tom.
Responda APENAS com JSON: {"captions": ["opção 1", "opção 2", "opção 3"]} — três abordagens diferentes
(ex.: emocional, informativa, direta para venda).`;
      const userMessage = [
        `Cliente: ${ctx.name || 'não informado'}`,
        ctx.briefing && `Briefing do cliente:\n${ctx.briefing}`,
        `Post: ${post.task_type === 'Arte' ? 'arte estática' : 'vídeo'}${post.format ? ` (${post.format})` : ''}${post.platform ? ` para ${post.platform}` : ''}`,
        `Título: ${post.title}`,
        clip(post.video_idea || post.description, 800) && `Ideia: ${clip(post.video_idea || post.description, 800)}`,
        clip(post.full_script, 2500) && `Roteiro:\n${clip(post.full_script, 2500)}`,
        clip(post.observations, 500) && `Observações: ${clip(post.observations, 500)}`,
        ctx.examples.length && `Legendas que este cliente já usou (imite o estilo, não copie):\n${ctx.examples.map((e, i) => `${i + 1}. ${clip(e, 600)}`).join('\n\n')}`,
      ].filter(Boolean).join('\n\n');

      const { data, error } = await supabase.functions.invoke('ai-copywriter', {
        body: { systemPrompt, userMessage, model: 'google/gemini-2.5-flash' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = (data as { result?: { captions?: unknown } | string })?.result;
      const list = typeof result === 'object' && result && Array.isArray(result.captions) ? result.captions : [];
      const captions = list.map(String).map((c) => c.trim()).filter(Boolean);
      if (!captions.length) throw new Error('A IA não devolveu legendas. Tente de novo.');
      setOptions(captions);
    } catch (e) {
      toast.error('Não foi possível sugerir legendas', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={generate} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {options.length ? 'Gerar outras' : 'Sugerir legenda'}
      </Button>
      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Clique numa opção para usar. Você pode editar antes de salvar.</p>
          {options.map((c, i) => (
            <button key={i} type="button" onClick={() => { onPick(c); setOptions([]); toast.success('Legenda aplicada. Revise e salve.'); }}
              className="block w-full rounded-lg border bg-card p-3 text-left text-sm leading-relaxed transition-colors hover:border-primary hover:bg-primary/5">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Opção {i + 1}</span>
              <span className="line-clamp-6 whitespace-pre-wrap">{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
