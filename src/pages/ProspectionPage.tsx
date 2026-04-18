import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Search, MapPin, Phone, Star, Globe, MessageCircle, 
  Loader2, Sparkles, Send, Building2, Plus, Trash2, 
  Copy, ExternalLink, Bot, Zap, ArrowRight, CheckCircle, Wand2,
  Instagram
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number;
  website: string;
  instagram?: string;
  category: string;
  aiMessage: string;
  isGenerating: boolean;
  status: 'novo' | 'contatado' | 'interessado' | 'fechado';
}

export default function ProspectionPage() {
  const [searchNiche, setSearchNiche] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // Persistência local
  const [agencyName, setAgencyName] = useState(() => localStorage.getItem('prospection_agency_name') || 'Inova Lab');
  const [agencyService, setAgencyService] = useState(() => localStorage.getItem('prospection_agency_service') || 'gestão de redes sociais e produção de conteúdo em vídeo');
  const [messageTemplate, setMessageTemplate] = useState(() => localStorage.getItem('prospection_message_template') || 'Oi! Tudo bem? Aqui é da {agencia} 👋\nVi o trabalho da {empresa} e achei incrível! Estamos ajudando negócios como o seu a crescer nas redes sociais com vídeos estratégicos.\nPosso te mandar alguns resultados que tivemos com clientes parecidos?');

  useEffect(() => {
    localStorage.setItem('prospection_agency_name', agencyName);
  }, [agencyName]);

  useEffect(() => {
    localStorage.setItem('prospection_agency_service', agencyService);
  }, [agencyService]);

  useEffect(() => {
    localStorage.setItem('prospection_message_template', messageTemplate);
  }, [messageTemplate]);

  // Manual lead add
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');
  const [manualInstagram, setManualInstagram] = useState('');
  const [manualCategory, setManualCategory] = useState('');

  // Magic Import
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const searchGooglePlaces = async () => {
    if (!searchNiche.trim() || !searchCity.trim()) {
      toast.error('Preencha o nicho e a cidade.');
      return;
    }

    setSearching(true);
    const query = `${searchNiche} em ${searchCity}`;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': geminiKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.websiteUri,places.primaryType'
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: 'pt-BR',
            maxResultCount: 20
          })
        }
      );

      if (!response.ok) {
        // Fallback: abrir Google Maps e adicionar manualmente
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
        toast.info('⚠️ Places API não ativada. Google Maps aberto — adicione leads manualmente com o ➕');
        setShowManualAdd(true);
        setSearching(false);
        return;
      }

      const data = await response.json();
      
      if (!data.places || data.places.length === 0) {
        toast.info('Nenhum resultado encontrado. Tente outro nicho ou cidade.');
        setSearching(false);
        return;
      }

      const newLeads: Lead[] = data.places.map((place: any) => {
        const name = place.displayName?.text || 'Sem nome';
        const filledMessage = messageTemplate
          .replace(/{empresa}/gi, name)
          .replace(/{agencia}/gi, agencyName);
        return {
          id: crypto.randomUUID(),
          name,
          address: place.formattedAddress || '',
          phone: place.nationalPhoneNumber || '',
          rating: place.rating || 0,
          website: place.websiteUri || '',
          category: place.primaryType?.replace(/_/g, ' ') || searchNiche,
          aiMessage: filledMessage,
          isGenerating: false,
          status: 'novo' as const,
        };
      });

      setLeads(prev => [...prev, ...newLeads]);
      const withPhone = newLeads.filter(l => l.phone).length;
      toast.success(`🎯 ${newLeads.length} leads encontrados! ${withPhone} com telefone.`);

    } catch (err: any) {
      console.error('Search error:', err);
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
      toast.info('Google Maps aberto — adicione leads manualmente com o ➕');
      setShowManualAdd(true);
    } finally {
      setSearching(false);
    }
  };

  const handleMagicImport = async () => {
    if (!magicText.trim()) {
      toast.error('Cole o texto do Google Maps primeiro.');
      return;
    }

    setIsExtracting(true);
    try {
      const prompt = `Você é um extrator de dados de leads do Google Maps. 
      Sua tarefa é extrair o Nome da Empresa, Telefone, Website e Instagram de cada lead contido no texto abaixo.
      Retorne APENAS um array JSON puro, no formato: [{"name": "Nome", "phone": "Telefone", "website": "URL", "instagram": "@perfil"}].
      Se não houver telefone no lead, ignore-o. Se não houver website ou instagram, deixe como string vazia "".
      Texto: ${magicText}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ],
          generation_config: {}
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Erro ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) throw new Error("A IA não retornou nenhum dado.");
      
      // Limpar possível markdown
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const extractedLeads = JSON.parse(jsonStr);

      if (!Array.isArray(extractedLeads) || extractedLeads.length === 0) {
        toast.error('Não foi possível encontrar leads válidos no texto.');
        return;
      }

      const newLeads: Lead[] = extractedLeads.map(item => {
        const filledMessage = messageTemplate
          .replace(/{empresa}/gi, item.name)
          .replace(/{agencia}/gi, agencyName);
        return {
          id: crypto.randomUUID(),
          name: item.name,
          address: '',
          phone: item.phone,
          rating: 0,
          website: item.website || '',
          instagram: item.instagram || '',
          category: searchNiche || 'Geral',
          aiMessage: filledMessage,
          isGenerating: false,
          status: 'novo' as const,
        };
      });

      setLeads(prev => [...prev, ...newLeads]);
      toast.success(`✨ ${newLeads.length} leads extraídos com sucesso!`);
      setMagicText('');
      setShowMagicModal(false);
    } catch (err: any) {
      console.error('Magic Import Error:', err);
      toast.error(`Falha na extração: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const addManualLead = () => {
    if (!manualName.trim()) {
      toast.error('Informe pelo menos o nome da empresa.');
      return;
    }

    const filledMessage = messageTemplate
      .replace(/{empresa}/gi, manualName)
      .replace(/{agencia}/gi, agencyName);

    const newLead: Lead = {
      id: crypto.randomUUID(),
      name: manualName,
      address: '',
      phone: manualPhone,
      rating: 0,
      website: manualWebsite,
      instagram: manualInstagram,
      category: manualCategory || searchNiche || 'Geral',
      aiMessage: filledMessage,
      isGenerating: false,
      status: 'novo',
    };

    setLeads(prev => [...prev, newLead]);
    setManualName('');
    setManualPhone('');
    setManualWebsite('');
    setManualInstagram('');
    setManualCategory('');
    setShowManualAdd(false);
    toast.success('Lead adicionado!');
  };

  const removeLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const generateMessage = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, isGenerating: true } : l));

    try {
      const prompt = `Gere uma mensagem de WhatsApp CURTA e PROFISSIONAL para prospectar o seguinte negócio:

EMPRESA: ${lead.name}
SEGMENTO: ${lead.category}
${lead.rating ? `AVALIAÇÃO: ${lead.rating} estrelas` : ''}

QUEM ESTÁ ENVIANDO: ${agencyName}
SERVIÇO OFERECIDO: ${agencyService}

REGRAS DA MENSAGEM:
- Máximo 4 linhas
- Cumprimento personalizado com o nome do negócio
- Elogio SUTIL e ESPECÍFICO sobre o segmento deles
- Proposta de valor clara e direta (o que vocês fazem que pode ajudá-los)
- Finalize com uma pergunta que gere resposta (ex: "Posso te enviar alguns cases?")
- Tom: profissional mas humano, como se fosse uma indicação
- NÃO use emojis em excesso (máximo 2)
- NÃO comece com "Olá, tudo bem?" (seja diferente)
- Escreva como mensagem de WhatsApp, não como email formal

Retorne SOMENTE o texto da mensagem, sem aspas, sem explicações.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) throw new Error('Erro ao gerar mensagem');

      const data = await response.json();
      const message = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!message) throw new Error('Resposta vazia da IA');

      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, aiMessage: message, isGenerating: false } : l));
      toast.success('💬 Mensagem gerada!');

    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(`Erro: ${err.message}`);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, isGenerating: false } : l));
    }
  };

  const generateAllMessages = async () => {
    const leadsWithoutMessage = leads.filter(l => !l.aiMessage && l.phone);
    if (leadsWithoutMessage.length === 0) {
      toast.info('Todos os leads com telefone já possuem mensagem.');
      return;
    }
    toast.info(`Gerando mensagens para ${leadsWithoutMessage.length} leads...`);
    for (const lead of leadsWithoutMessage) {
      await generateMessage(lead.id);
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }
    toast.success('Todas as mensagens foram geradas! 🎉');
  };

  const openWhatsApp = (lead: Lead) => {
    if (!lead.phone) {
      toast.error('Este lead não possui telefone cadastrado.');
      return;
    }
    const phone = lead.phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const message = encodeURIComponent(lead.aiMessage || `Olá, aqui é da ${agencyName}! Vi o trabalho da ${lead.name} e gostaria de conversar sobre uma parceria.`);
    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'contatado' } : l));
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensagem copiada!');
  };

  const statusColors: Record<string, string> = {
    novo: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30',
    contatado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    interessado: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    fechado: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-7xl mx-auto space-y-8 pb-12"
    >
      {/* Header */}
      <div className="px-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary" />
          Prospecção com IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Encontre leads no Google Maps, gere mensagens personalizadas e envie via WhatsApp em 1 clique.
        </p>
      </div>

      {/* Config da Agência */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-primary flex items-center gap-2">
            <Zap className="w-4 h-4" /> Identidade do Prospector
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm">Configure sua agência e a mensagem que será enviada para cada lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Agência</Label>
              <Input value={agencyName} onChange={e => setAgencyName(e.target.value)} className="bg-black/60 border-white/10" placeholder="Sua agência" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serviço que você oferece</Label>
              <Input value={agencyService} onChange={e => setAgencyService(e.target.value)} className="bg-black/60 border-white/10" placeholder="Ex: gestão de redes sociais" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-primary" /> Mensagem Padrão de Prospecção
            </Label>
            <Textarea 
              value={messageTemplate} 
              onChange={e => setMessageTemplate(e.target.value)} 
              className="bg-black/60 border-white/10 min-h-[100px] text-sm leading-relaxed" 
              placeholder="Escreva sua mensagem aqui..."
            />
            <p className="text-xs text-zinc-500">Use <code className="text-primary bg-primary/10 px-1 rounded">{'{empresa}'}</code> para o nome do negócio e <code className="text-primary bg-primary/10 px-1 rounded">{'{agencia}'}</code> para o nome da sua agência. Eles serão substituídos automaticamente.</p>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Pesquisa */}
      <Card className="border-white/10 bg-black/40">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Nicho / Segmento</Label>
              <Input 
                value={searchNiche} 
                onChange={e => setSearchNiche(e.target.value)} 
                placeholder="Ex: clínicas odontológicas, restaurantes, academias..." 
                className="bg-black/60 border-white/10 h-12"
                onKeyDown={e => e.key === 'Enter' && searchGooglePlaces()}
              />
            </div>
            <div className="w-full sm:w-[250px] space-y-1">
              <Label className="text-xs text-muted-foreground">Cidade</Label>
              <Input 
                value={searchCity} 
                onChange={e => setSearchCity(e.target.value)} 
                placeholder="Ex: Goiânia" 
                className="bg-black/60 border-white/10 h-12"
                onKeyDown={e => e.key === 'Enter' && searchGooglePlaces()}
              />
            </div>
            <div className="flex gap-2 items-end">
              <Button 
                onClick={searchGooglePlaces} 
                disabled={searching}
                className="h-12 px-6 bg-primary text-black font-bold shadow-lg shadow-primary/20"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Buscar Leads
              </Button>

              <Dialog open={showMagicModal} onOpenChange={setShowMagicModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-12 border-primary/20 text-primary hover:bg-primary/10">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Importador Mágico
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] bg-[#121212] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                      <Wand2 className="w-5 h-5" /> Importador Mágico ✨
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Vá no Google Maps, faça sua pesquisa, selecione e copie (Ctrl+A / Ctrl+C) todos os resultados da barra lateral e cole abaixo. A IA vai extrair nomes e telefones automaticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <Textarea 
                      placeholder="Cole aqui o texto copiado do Google Maps..." 
                      className="min-h-[250px] bg-black/40 border-white/10 text-xs font-mono leading-relaxed"
                      value={magicText}
                      onChange={(e) => setMagicText(e.target.value)}
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Total de caracteres: {magicText.length}</span>
                      <span>Dica: Não se preocupe com a bagunça do texto, a IA entende tudo.</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowMagicModal(false)}
                      disabled={isExtracting}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleMagicImport} 
                      disabled={isExtracting || !magicText.trim()}
                      className="bg-primary text-black font-bold"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Extraindo Leads...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Extrair Leads Agora
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                onClick={() => setShowManualAdd(!showManualAdd)}
                className="h-12 border-white/10"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Manual Add Form */}
          {showManualAdd && (
            <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl flex flex-col gap-3 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Empresa</Label>
                  <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Ex: Academia X" className="bg-black/60 border-white/10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Ex: 62999..." className="bg-black/60 border-white/10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Website</Label>
                  <Input value={manualWebsite} onChange={e => setManualWebsite(e.target.value)} placeholder="https://..." className="bg-black/60 border-white/10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Instagram</Label>
                  <Input value={manualInstagram} onChange={e => setManualInstagram(e.target.value)} placeholder="@perfil" className="bg-black/60 border-white/10" />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Segmento</Label>
                  <Input value={manualCategory} onChange={e => setManualCategory(e.target.value)} placeholder="Odontologia" className="bg-black/60 border-white/10" />
                </div>
                <Button onClick={addManualLead} variant="secondary" className="h-10">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Bar */}
      {leads.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            <span className="text-white font-bold">{leads.length}</span> leads na lista
          </p>
          <Button onClick={generateAllMessages} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
            <Sparkles className="w-4 h-4 mr-2" /> Gerar Mensagens para Todos
          </Button>
        </div>
      )}

      {/* Leads List */}
      {leads.length === 0 ? (
        <div className="text-center py-20 border border-white/5 border-dashed rounded-2xl bg-black/20">
          <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 mb-2">Nenhum lead prospectado ainda.</p>
          <p className="text-zinc-600 text-sm">Pesquise um nicho + cidade acima ou adicione leads manualmente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map(lead => (
            <div key={lead.id} className="border border-white/5 bg-[#0c0c0c] rounded-2xl overflow-hidden shadow-md hover:border-white/10 transition-colors">
              
              {/* Lead Header */}
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-primary/10 border border-primary/20 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{lead.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-zinc-400">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone || 'N/A'}</span>
                      {lead.website && (
                        <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                      {lead.instagram && (
                        <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pink-500 hover:underline">
                          <Instagram className="w-3 h-3" /> Instagram
                        </a>
                      )}
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.address || 'Goiânia, GO'}</span>
                      {lead.rating > 0 && <span className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3 fill-amber-400" /> {lead.rating}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={`${statusColors[lead.status]} border text-xs font-bold`}>
                    {lead.status.toUpperCase()}
                  </Badge>
                  <select 
                    value={lead.status}
                    onChange={e => setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: e.target.value as Lead['status'] } : l))}
                    className="bg-black/60 border border-white/10 text-xs text-zinc-400 rounded px-2 py-1"
                  >
                    <option value="novo">Novo</option>
                    <option value="contatado">Contatado</option>
                    <option value="interessado">Interessado</option>
                    <option value="fechado">Fechado</option>
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeLead(lead.id)} className="text-zinc-600 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* AI Message Section */}
              <div className="border-t border-white/5 p-5 bg-black/30">
                {lead.aiMessage ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider">
                      <MessageCircle className="w-3 h-3" /> Mensagem de Prospecção
                    </div>
                    <p className="text-zinc-300 leading-relaxed bg-black/40 border border-white/5 p-4 rounded-xl whitespace-pre-wrap text-sm">
                      {lead.aiMessage}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => openWhatsApp(lead)} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg">
                        <Send className="w-4 h-4 mr-2" /> Abrir WhatsApp
                      </Button>
                      <Button variant="outline" className="border-white/10" onClick={() => copyMessage(lead.aiMessage)}>
                        <Copy className="w-4 h-4 mr-2" /> Copiar
                      </Button>
                      <Button variant="ghost" className="text-primary" onClick={() => generateMessage(lead.id)}>
                        <Sparkles className="w-4 h-4 mr-2" /> Gerar Outra
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={() => generateMessage(lead.id)} 
                      disabled={lead.isGenerating}
                      variant="outline" 
                      className="border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {lead.isGenerating ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Gerar Mensagem com IA</>
                      )}
                    </Button>
                    {lead.phone && (
                      <Button variant="ghost" className="text-green-500" onClick={() => openWhatsApp(lead)}>
                        <Send className="w-4 h-4 mr-2" /> WhatsApp Direto
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
