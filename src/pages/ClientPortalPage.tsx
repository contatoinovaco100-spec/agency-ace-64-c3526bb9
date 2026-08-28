import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Tag, Target, Video, CheckCircle2, VideoIcon, Eye, ArrowRight, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { PAGE_THUMBS } from '@/lib/pageThumbs';

interface EditorialLine {
  niche: string;
  audience: string;
  tone: string;
  objective: string;
  pillars: string[];
}

interface ContentIdea {
  id: string;
  title: string;
  content_type: string;
  pillar: string;
  objective: string;
  status: string;
  scheduled_date: string;
  script?: ContentScript;
}

interface ContentScript {
  hook: string;
  development: string;
  cta: string;
  observations: string;
}

export default function ClientPortalPage() {
  useSeo({
    title: 'Portal do Cliente — INOVA Co.',
    description: 'Acompanhe seus conteúdos, entregas e cronograma com a INOVA Co.',
    image: PAGE_THUMBS.conteudo,
    noindex: true,
  });
  const { clientId } = useParams<{ clientId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('Seu Cliente');
  
  const [editorialLine, setEditorialLine] = useState<EditorialLine | null>(null);
  const [scheduledIdeas, setScheduledIdeas] = useState<ContentIdea[]>([]);

  useEffect(() => {
    async function fetchPortalData() {
      if (!clientId) return;
      try {
        setLoading(true);
        
        // 1. Fetch Client Name
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('company_name')
          .eq('id', clientId)
          .maybeSingle();
          
        if (clientData) setClientName(clientData.company_name);

        // 2. Fetch Editorial Line
        const { data: editorialData } = await supabase
          .from('content_editorial_lines')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();
          
        if (editorialData) {
          setEditorialLine(editorialData);
        }

        // 3. Fetch Scheduled Ideas and corresponding Scripts
        const { data: ideasData } = await supabase
          .from('content_ideas')
          .select('*')
          .eq('client_id', clientId)
          .not('status', 'eq', 'Postado')
          .order('scheduled_date', { ascending: true });
          
        if (ideasData && ideasData.length > 0) {
          const scheduled = ideasData.filter(i => i.scheduled_date !== null);
          
          if (scheduled.length > 0) {
            const ideaIds = scheduled.map(i => i.id);
            const { data: scriptsData } = await supabase
              .from('content_scripts')
              .select('*')
              .in('idea_id', ideaIds);
              
            const completeIdeas = scheduled.map(idea => {
              const script = scriptsData?.find(s => s.idea_id === idea.id);
              return { ...idea, script } as ContentIdea;
            });
            
            setScheduledIdeas(completeIdeas);
          }
        }
      } catch (err) {
        console.error('Error fetching portal data:', err);
        setError('Ocorreu um erro ao carregar o portal. Verifique o link e tente novamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchPortalData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-white">Carregando Dashboard...</h2>
        <p className="text-muted-foreground mt-2">Buscando as estratégias aprovadas</p>
      </div>
    );
  }

  if (error || !clientName) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Portal Indisponível</h2>
        <p className="text-muted-foreground max-w-md">{error || "Cliente não encontrado ou portal não configurado."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 pb-20 selection:bg-primary/30">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-black/50 border-b border-white/5 py-12 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center text-center">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-6 hover:bg-primary/20 px-3 py-1 text-xs">
            PORTAL DO CLIENTE
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Estratégia de Conteúdo <br className="hidden sm:block"/>
            <span className="text-primary">{clientName}</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg text-muted-foreground">
            Acompanhe o planejamento completo da sua marca, desde a estrutura da linha editorial até os roteiros finais dos vídeos que gravaremos para suas redes.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-12 space-y-16">
        
        {/* Editorial Line Section */}
        {editorialLine && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Linha Editorial</h2>
                <p className="text-sm text-muted-foreground">O mapa da mina da nossa comunicação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-zinc-950/50 border-white/5 hover:border-white/10 transition-colors">
                <CardHeader className="p-5 pb-3">
                  <Badge variant="outline" className="w-fit mb-2 bg-white/5">Público</Badge>
                  <CardTitle className="text-base font-semibold leading-tight text-white">{editorialLine.audience || '-'}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-zinc-950/50 border-white/5 hover:border-white/10 transition-colors">
                <CardHeader className="p-5 pb-3">
                  <Badge variant="outline" className="w-fit mb-2 bg-white/5">Nicho</Badge>
                  <CardTitle className="text-base font-semibold leading-tight text-white">{editorialLine.niche || '-'}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-zinc-950/50 border-white/5 hover:border-white/10 transition-colors">
                <CardHeader className="p-5 pb-3">
                  <Badge variant="outline" className="w-fit mb-2 bg-white/5">Tom de Voz</Badge>
                  <CardTitle className="text-base font-semibold leading-tight text-white">{editorialLine.tone || '-'}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-zinc-950/50 border-white/5 hover:border-white/10 transition-colors">
                <CardHeader className="p-5 pb-3">
                  <Badge variant="outline" className="w-fit mb-2 bg-white/5">Objetivo Master</Badge>
                  <CardTitle className="text-base font-semibold leading-tight text-white">{editorialLine.objective || '-'}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {editorialLine.pillars && editorialLine.pillars.length > 0 && (
              <div className="mt-6 p-6 rounded-2xl bg-zinc-900/30 border border-white/5">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Pilares de Conteúdo Aprovados</h4>
                <div className="flex flex-wrap gap-2">
                  {editorialLine.pillars.map((pillar, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-md bg-white/5 text-sm font-medium border border-white/10 text-zinc-300">
                      {pillar}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Calendar and Scripts Section */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Cronograma & Roteiros</h2>
              <p className="text-sm text-muted-foreground">Os conteúdos que já estão mapeados no tempo</p>
            </div>
          </div>

          {scheduledIdeas.length === 0 ? (
             <div className="text-center py-16 px-4 rounded-2xl bg-zinc-900/30 border border-white/5">
                <VideoIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-1">Nenhum conteúdo agendado</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">Em breve novos materiais estarão disponíveis e agendados para a sua conta.</p>
             </div>
          ) : (
            <div className="space-y-6">
              {scheduledIdeas.map((idea, index) => {
                const postDate = new Date(idea.scheduled_date);
                const isPast = postDate < new Date();

                return (
                  <div key={idea.id} className={`flex flex-col md:flex-row gap-4 md:gap-8 rounded-2xl p-6 transition-all duration-300 ${isPast ? 'bg-zinc-950/20 opacity-60 grayscale-[30%]' : 'bg-zinc-950/80 border border-white/5 hover:border-white/10 shadow-lg'}`}>
                    
                    {/* Data Indicator */}
                    <div className="shrink-0 flex flex-row md:flex-col items-center gap-4 md:gap-1 md:w-32">
                       <div className="flex flex-col items-center justify-center h-16 w-16 md:h-24 md:w-24 rounded-2xl bg-zinc-900 border border-white/10 shadow-inner">
                          <span className="text-xs font-semibold text-primary uppercase">{format(postDate, 'MMM', { locale: ptBR })}</span>
                          <span className="text-2xl md:text-3xl font-black text-white">{format(postDate, 'dd')}</span>
                       </div>
                       <div className="flex md:hidden flex-col">
                          <span className="text-sm font-medium text-white">{format(postDate, 'EEEE', { locale: ptBR })}</span>
                          <span className="text-xs text-muted-foreground">{idea.status}</span>
                       </div>
                       <Badge variant="outline" className="hidden md:flex mt-2 w-full justify-center bg-transparent border-white/10 text-muted-foreground">{idea.status}</Badge>
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {idea.content_type && <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{idea.content_type}</Badge>}
                          {idea.pillar && <Badge variant="outline" className="border-white/10 text-zinc-400">{idea.pillar}</Badge>}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{idea.title}</h3>
                        {idea.objective && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Target className="w-3.5 h-3.5"/> {idea.objective}</p>}
                      </div>

                      {/* Scripts / Texts Box */}
                      {idea.script ? (
                        <div className="rounded-xl bg-black/40 border border-white/5 p-4 sm:p-5 mt-4 space-y-4">
                           {idea.script.hook && (
                             <div>
                               <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-primary"/> Gancho <span className="text-muted-foreground font-normal normal-case">(Os primeiros 3 segundos)</span></h4>
                               <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 p-3 rounded-lg border border-white/5">{idea.script.hook}</p>
                             </div>
                           )}
                           
                           {idea.script.development && (
                             <div>
                               <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-primary"/> Desenvolvimento</h4>
                               <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{idea.script.development}</p>
                             </div>
                           )}

                           {idea.script.cta && (
                             <div>
                               <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-primary"/> Call To Action</h4>
                               <p className="text-sm text-zinc-300 leading-relaxed font-medium">"{idea.script.cta}"</p>
                             </div>
                           )}

                           {idea.script.observations && (
                             <div className="pt-3 border-t border-white/10 mt-3">
                               <h4 className="text-xs font-semibold text-muted-foreground mb-1">Notas de Gravação:</h4>
                               <p className="text-sm text-zinc-400 italic">*{idea.script.observations}</p>
                             </div>
                           )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 p-5 text-center flex flex-col items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground font-medium">Roteirização em andamento</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">O script exato deste vídeo será disponibilizado aqui em breve.</p>
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </section>

      </div>
      
      {/* Footer */}
      <footer className="mt-20 border-t border-white/5 py-8 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
        <UserCircle className="w-4 h-4" />
        Portal Seguro do Cliente
      </footer>

    </div>
  );
}
