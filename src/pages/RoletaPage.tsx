import { useState, useRef, useEffect } from 'react';
import { Gift, Plus, Trash2, RotateCcw, Trophy, Sparkles, RefreshCw, Settings, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Design Moderno: Cores escuras intercaladas com destaques em Neon
const MODERN_COLORS = [
  { bg: '#09090b', text: '#ffffff' }, // Zinc 950 + Branco
  { bg: '#18181b', text: '#c9f31d' }, // Zinc 900 + Verde Neon
];

// Cor extra para garantir que o último não bata com o primeiro em números ímpares
const ODD_COLOR = { bg: '#27272a', text: '#ffffff' }; // Zinc 800 + Branco

const DEFAULT_ITEMS = [
  '🏆 Meta Batida!',
  '🎁 Bônus Surpresa',
  '📈 Dia de Folga',
  '🍕 Almoço da Equipe',
  '💰 Comissão Extra',
  '🎯 Próximo Nível',
  '⭐ Destaque do Mês',
  '🚀 Projeto Especial'
];

export default function RoletaPage() {
  const { toast } = useToast();
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [newItem, setNewItem] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const spinRef = useRef(0);

  // Monitora mudança de tela cheia
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        toast({ title: 'Erro ao entrar em tela cheia', description: err.message, variant: 'destructive' });
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    if (items.length >= 32) {
      toast({ title: 'Limite atingido', description: 'A roleta suporta no máximo 32 prêmios.', variant: 'destructive' });
      return;
    }
    setItems(it => [...it, newItem.trim()]);
    setNewItem('');
    toast({ title: 'Prêmio adicionado com sucesso!' });
  };

  const removeItem = (i: number) => {
    setItems(it => it.filter((_, idx) => idx !== i));
  };

  const resetDefault = () => {
    setItems(DEFAULT_ITEMS);
    setWinner(null);
    toast({ title: 'Prêmios padrão restaurados!' });
  };

  const startSpinFlow = () => {
    if (spinning || countdown || items.length < 2) return;
    setWinner(null);
    setCountdown('3');
    
    setTimeout(() => setCountdown('2'), 1000);
    setTimeout(() => setCountdown('1'), 2000);
    setTimeout(() => setCountdown('GO!'), 3000);
    setTimeout(() => {
      setCountdown(null);
      executeSpin();
    }, 4000);
  };

  const executeSpin = () => {
    setSpinning(true);
    // Gira entre 6 e 9 voltas completas + um ângulo aleatório
    const extraSpins = 2160 + Math.floor(Math.random() * 1080);
    const newRot = spinRef.current + extraSpins;
    spinRef.current = newRot;
    setRotation(newRot);

    setTimeout(() => {
      setSpinning(false);
      const sliceAngle = 360 / items.length;
      const normalized = ((newRot % 360) + 360) % 360;
      // O ponteiro está no topo (-90 graus no círculo trigonométrico)
      const winnerIdx = Math.floor((360 - normalized) / sliceAngle) % items.length;
      const wonItem = items[winnerIdx];
      setWinner(wonItem);
      toast({
        title: '🎉 Temos um vencedor!',
        description: `Prêmio sorteado: ${wonItem}`,
      });
    }, 5000);
  };

  const getColor = (i: number) => {
    if (items.length % 2 !== 0 && i === items.length - 1) {
      return ODD_COLOR;
    }
    return MODERN_COLORS[i % 2];
  };

  // Coordenadas e dimensões do SVG
  const size = 750;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 16; // 359
  const r = outerRadius - 16; // 343

  const sliceAngle = items.length > 0 ? (2 * Math.PI) / items.length : 0;

  const slicePath = (i: number) => {
    if (items.length === 1) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    }
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // DIAGRAMAÇÃO: Texto posicionado na borda externa, apontando para fora do centro
  const textTransform = (i: number) => {
    const angle = (i + 0.5) * sliceAngle - Math.PI / 2;
    // Ancorar o texto no fim (textAnchor="end") a 88% do raio (próximo à borda externa)
    const tx = cx + (r * 0.88) * Math.cos(angle);
    const ty = cy + (r * 0.88) * Math.sin(angle);
    // Rotação exata do raio para que o texto fique deitado ao longo da fatia
    const deg = ((i + 0.5) * (360 / items.length)) - 90;
    return { tx, ty, deg };
  };

  // Pinos decorativos com visual minimalista moderno
  const studs = Array.from({ length: 32 }, (_, i) => {
    const angle = (i * 360 / 32) * (Math.PI / 180);
    return {
      x: cx + outerRadius * Math.cos(angle),
      y: cy + outerRadius * Math.sin(angle),
    };
  });

  return (
    <div className="min-h-screen flex flex-col space-y-6 pb-12 w-full mx-auto px-4 sm:px-6 lg:px-8 relative selection:bg-[#c9f31d] selection:text-black bg-[#050505]">
      {/* Background ambiente super escuro e clean */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050505]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-[#c9f31d]/[0.03] blur-[150px]" />
      </div>

      {/* Cabeçalho Superior Minimalista */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0 max-w-[1600px] mx-auto w-full">
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9f31d]/10 ring-1 ring-[#c9f31d]/20 shadow-[0_0_20px_rgba(201,243,29,0.1)] shrink-0">
            <Gift className="h-8 w-8 text-[#c9f31d]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Roleta <span className="text-[#c9f31d] font-light">Pro</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-xl">
              Sistema de gamificação premium. Adicione prêmios e inicie o sorteio.
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="relative flex flex-wrap items-center gap-3 self-start sm:self-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-[#c9f31d]/30 hover:bg-[#c9f31d]/10 bg-transparent h-12 px-6 rounded-2xl gap-2.5 text-sm font-bold text-[#c9f31d] hover:text-[#c9f31d] transition-all"
              >
                <Settings className="w-5 h-5" />
                Configurar Prêmios ({items.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-white/10 bg-[#09090b]/95 backdrop-blur-3xl shadow-2xl max-h-[90vh] flex flex-col rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#c9f31d]" /> Gerenciar Prêmios
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 my-2 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex gap-2">
                  <Input
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Nome do prêmio..."
                    className="bg-black/50 border-white/10 focus:ring-[#c9f31d] h-12 text-sm font-medium rounded-xl text-white"
                  />
                  <Button onClick={addItem} className="bg-[#c9f31d] text-black hover:bg-[#a8de15] font-black h-12 w-12 rounded-xl shrink-0 transition-transform hover:scale-105">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar max-h-[50vh]">
                  {items.map((item, i) => {
                    const colorObj = getColor(i);
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition-all group shadow-sm">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: colorObj.text === '#c9f31d' ? '#c9f31d' : '#ffffff' }} />
                          <span className="text-sm font-bold text-white truncate">{item}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                      <Gift className="w-12 h-12 text-zinc-700 mb-3" />
                      <p className="text-zinc-500 font-medium text-sm">Lista de prêmios vazia.</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between border-t border-white/10 pt-4 mt-auto">
                <Button variant="outline" onClick={resetDefault} className="border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white w-full sm:w-auto gap-2 text-xs font-semibold h-11 rounded-xl">
                  <RefreshCw className="w-4 h-4" /> Restaurar Padrão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={toggleFullscreen}
            className="border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white h-12 px-5 rounded-2xl gap-2 text-sm font-semibold transition-all"
            title={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
          </Button>
        </div>
      </div>

      {/* Área Central da Roleta Gigante */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[900px] mx-auto relative my-auto py-8">
        
        {/* Container Responsivo da Roleta Gigante */}
        <div className="relative w-full max-w-[750px] flex justify-center items-center">
          
          {/* Ponteiro Moderno no Topo */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_0_15px_rgba(201,243,29,0.8)]">
            <svg width="48" height="60" viewBox="0 0 48 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 60L4 20C4 8.95431 12.9543 0 24 0C35.0457 0 44 8.95431 44 20L24 60Z" fill="#c9f31d" />
              <circle cx="24" cy="20" r="6" fill="#050505" />
            </svg>
          </div>

          {/* Sombra e Brilho atrás da Roleta */}
          <div className="absolute inset-0 rounded-full bg-[#c9f31d]/5 blur-[120px] -z-10" />

          {/* Estrutura SVG da Roleta Gigante */}
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-auto aspect-square rounded-full filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] select-none"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)' : 'none',
            }}
          >
            {/* Borda Externa Minimalista */}
            <circle cx={cx} cy={cy} r={outerRadius} fill="#050505" stroke="#18181b" strokeWidth="32" />
            <circle cx={cx} cy={cy} r={outerRadius} fill="none" stroke="#27272a" strokeWidth="2" opacity="0.8" />
            <circle cx={cx} cy={cy} r={outerRadius - 16} fill="none" stroke="#c9f31d" strokeWidth="1" opacity="0.4" />

            {/* Fatias da Roleta */}
            {items.map((item, i) => {
              const colorObj = getColor(i);
              const { tx, ty, deg } = textTransform(i);
              return (
                <g key={i}>
                  <path
                    d={slicePath(i)}
                    fill={colorObj.bg}
                    stroke="#27272a"
                    strokeWidth="2"
                  />
                  {items.length > 1 && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="end" /* Ancorado no final (borda externa) */
                      dominantBaseline="middle"
                      transform={`rotate(${deg}, ${tx}, ${ty})`}
                      fill={colorObj.text}
                      fontSize={items.length > 24 ? 14 : items.length > 16 ? 18 : 22}
                      fontWeight="800"
                      letterSpacing="1"
                      className="drop-shadow-sm"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {item.length > 25 ? item.slice(0, 23) + '…' : item}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Pinos Decorativos Modernos no Aro */}
            {studs.map((stud, idx) => (
              <circle
                key={idx}
                cx={stud.x}
                cy={stud.y}
                r={3}
                fill={idx % 2 === 0 ? '#c9f31d' : '#3f3f46'}
              />
            ))}

            {/* Centro da Roleta (Miolo) Minimalista */}
            <circle cx={cx} cy={cy} r={40} fill="#09090b" stroke="#18181b" strokeWidth="8" filter="drop-shadow(0 0 10px rgba(0,0,0,1))" />
            <circle cx={cx} cy={cy} r={12} fill="#c9f31d" opacity="0.8" />
          </svg>

          {/* OVERLAY DE CONTAGEM REGRESSIVA (3, 2, 1, GO!) */}
          {countdown && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full animate-in fade-in duration-300">
              <div key={countdown} className="animate-in zoom-in-50 spin-in-12 fade-in duration-500 flex flex-col items-center justify-center">
                <span className="text-[12rem] sm:text-[18rem] font-black text-[#c9f31d] tracking-tighter filter drop-shadow-[0_0_80px_rgba(201,243,29,0.9)] leading-none select-none">
                  {countdown}
                </span>
                {countdown === 'GO!' && (
                  <span className="text-2xl sm:text-4xl font-black text-white tracking-widest mt-4 animate-bounce uppercase select-none">
                    BOA SORTE! 🚀
                  </span>
                )}
              </div>
            </div>
          )}

          {/* OVERLAY DE CELEBRAÇÃO DO VENCEDOR */}
          {winner && !spinning && !countdown && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-full animate-in fade-in zoom-in duration-500 p-6">
              <div className="relative max-w-xl w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#09090b]/90 p-8 sm:p-12 backdrop-blur-3xl shadow-[0_0_80px_rgba(201,243,29,0.3)] text-center space-y-8 animate-bounce-short">
                <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#c9f31d]/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#c9f31d]/10 ring-1 ring-[#c9f31d]/30 text-[#c9f31d] shadow-[0_0_30px_rgba(201,243,29,0.2)] animate-pulse">
                  <Trophy className="h-10 w-10" />
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm font-black text-[#c9f31d] uppercase tracking-[0.2em]">Resultado Final</span>
                  </div>
                  <p className="text-3xl sm:text-5xl font-black text-white tracking-tight break-words py-2">{winner}</p>
                </div>
                
                <div className="pt-6 flex justify-center relative z-10">
                  <Button
                    onClick={() => setWinner(null)}
                    className="bg-white text-black hover:bg-zinc-200 font-black text-lg px-10 py-7 rounded-2xl transition-all hover:scale-105"
                  >
                    Novo Sorteio
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Girar Gigante e Minimalista */}
        <div className="mt-12 mb-4 z-10 w-full max-w-sm">
          <Button
            onClick={startSpinFlow}
            disabled={spinning || !!countdown || items.length < 2}
            className="w-full bg-[#c9f31d] text-black hover:bg-[#a8de15] font-black text-2xl py-9 rounded-[1.5rem] shadow-[0_0_40px_rgba(201,243,29,0.3)] transition-all transform hover:scale-105 active:scale-95 gap-4 flex items-center justify-center border border-white/20 uppercase tracking-wide"
          >
            {spinning || countdown ? (
              <>
                <RotateCcw className="h-7 w-7 text-black animate-spin" />
                Girando...
              </>
            ) : (
              'GIRAR ROLETA!'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
