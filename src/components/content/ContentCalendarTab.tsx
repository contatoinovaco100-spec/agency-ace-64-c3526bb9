import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContentIdea {
  id: string;
  title: string;
  content_type: string | null;
  status: string | null;
  scheduled_date: string | null;
}

export function ContentCalendarTab({ clientId }: { clientId: string }) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadIdeas();
  }, [clientId]);

  async function loadIdeas() {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_ideas')
        .select('id, title, content_type, status, scheduled_date')
        .eq('client_id', clientId);
      
      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      console.error('Error loading calendar ideas:', error);
      toast.error('Erro ao carregar calendário');
    } finally {
      setLoading(false);
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('idea_id', id);
    // Add visual feedback
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = async (e: React.DragEvent, date: Date | null) => {
    e.preventDefault();
    const ideaId = e.dataTransfer.getData('idea_id');
    if (!ideaId) return;

    // Se date for null, estamos movendo para o "Backlog"
    const newDateStr = date ? date.toISOString() : null;

    // Optimistic UI update
    const previousIdeas = [...ideas];
    setIdeas(ideas.map(idea => idea.id === ideaId ? { ...idea, scheduled_date: newDateStr } : idea));

    try {
      const { error } = await supabase
        .from('content_ideas')
        .update({ scheduled_date: newDateStr })
        .eq('id', ideaId);
        
      if (error) throw error;
      toast.success(date ? 'Conteúdo agendado!' : 'Conteúdo movido para a lista de espera');
    } catch (error) {
      console.error('Error scheduling idea:', error);
      toast.error('Erro ao remarcar conteúdo');
      setIdeas(previousIdeas); // Revert
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const unscheduledIdeas = ideas.filter(i => !i.scheduled_date);
  const scheduledIdeas = ideas.filter(i => i.scheduled_date);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Aprovado': return 'bg-blue-500 text-white';
      case 'Gravado': return 'bg-purple-500 text-white';
      case 'Em edição': return 'bg-orange-500 text-white';
      case 'Postado': return 'bg-green-500 text-white';
      default: return 'bg-primary text-primary-foreground'; 
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar: Backlog */}
      <Card className="lg:col-span-1 border-foreground/5 bg-card h-[600px] flex flex-col">
        <CardHeader className="pb-3 border-b border-foreground/5">
          <CardTitle className="text-lg">Não Agendados</CardTitle>
          <p className="text-xs text-muted-foreground">Arraste para o calendário</p>
        </CardHeader>
        <CardContent 
          className="p-4 flex-1 overflow-y-auto space-y-3"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          {unscheduledIdeas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-4">Nenhum conteúdo na fila.</p>
          ) : (
            unscheduledIdeas.map(idea => (
              <div 
                key={idea.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idea.id)}
                onDragEnd={handleDragEnd}
                className="p-3 rounded-md bg-muted/60 border border-foreground/10 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-tight mb-1">{idea.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {idea.content_type && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{idea.content_type}</Badge>}
                      {idea.status && <Badge variant="default" className={`text-[10px] px-1 py-0 h-4 ${getStatusColor(idea.status)}`}>{idea.status}</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Main Calendar */}
      <Card className="lg:col-span-3 border-foreground/5 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8">
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 pt-0">
          
          <div className="grid grid-cols-7 gap-px sm:gap-1 mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px sm:gap-1 bg-foreground/5 rounded-lg overflow-hidden border border-foreground/5">
            {days.map((day, dayIdx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayIdeas = scheduledIdeas.filter(idea => idea.scheduled_date && format(new Date(idea.scheduled_date), 'yyyy-MM-dd') === dateKey);
              const isCurrentMonth = isSameMonth(day, monthStart);
              
              return (
                <div 
                  key={day.toString()}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={`min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 bg-background transition-colors hover:bg-card ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <div className={`text-right text-xs mb-1 font-medium ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, dateFormat)}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[80px] sm:max-h-[100px] scrollbar-none">
                    {dayIdeas.map(idea => (
                      <div 
                        key={idea.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idea.id)}
                        onDragEnd={handleDragEnd}
                        title={idea.title}
                        className={`text-[10px] sm:text-xs p-1 rounded rounded-md truncate cursor-grab active:cursor-grabbing text-foreground border border-foreground/10 ${getStatusColor(idea.status)}`}
                      >
                        {idea.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

        </CardContent>
      </Card>
      
    </div>
  );
}
