import { useState, useRef, useEffect } from 'react';
import { Gift, Plus, Trash2, RotateCcw, Trophy, Sparkles, RefreshCw, Settings, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const SLICE_COLORS = [
  { bg: '#c9f31d', text: '#000000' }, // Lime
  { bg: '#8b5cf6', text: '#ffffff' }, // Purple
  { bg: '#14b8a6', text: '#ffffff' }, // Teal
  { bg: '#f59e0b', text: '#000000' }, // Amber
  { bg: '#ef4444', text: '#ffffff' }, // Red
  { bg: '#3b82f6', text: '#ffffff' }, // Blue
  { bg: '#10b981', text: '#000000' }, // Emerald
  { bg: '#ec4899', text: '#ffffff' }, // Pink
  { bg: '#f97316', text: '#ffffff' }, // Orange
  { bg: '#6366f1', text: '#ffffff' }, // Indigo
];

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
      // O ponteiro está no topo (270 graus ou -90 graus no círculo trigonométrico)
      const winnerIdx = Math.floor((360 - normalized) / sliceAngle) % items.length;
      const wonItem = items[winnerIdx];
      setWinner(wonItem);
      toast({
        title: '🎉 Temos um vencedor!',
        description: `Prêmio sorteado: ${wonItem}`,
      });
    }, 5000);
  };

  // Coordenadas e dimensões do SVG (viewBox 750x750 para tamanho gigante e tela cheia)
  const size = 750;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 16; // 359
  const r = outerRadius - 20; // 339

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

  const textTransform = (i: number) => {
    const angle = (i + 0.5) * sliceAngle - Math.PI / 2;
    const tx = cx + (r * 0.72) * Math.cos(angle);
    const ty = cy + (r * 0.72) * Math.sin(angle);
    const deg = ((i + 0.5) * (360 / items.length)) - 90;
    return { tx, ty, deg };
  };

  // Pinos decorativos ao redor da roleta gigante
  const studs = Array.from({ length: 32 }, (_, i) => {
    const angle = (i * 360 / 32) * (Math.PI / 180);
    return {
      x: cx + outerRadius * Math.cos(angle),
      y: cy + outerRadius * Math.sin(angle),
    };
  });

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col space-y-6 pb-12 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative selection:bg-[#c9f31d] selection:text-black">
      {/* Background ambiente com brilhos premium */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[#c9f31d]/[0.08] blur-[180px]" />
        <div className="absolute top-1/3 -left-20 h-[500px] w-[500px] rounded-full bg-purple-500/[0.06] blur-[150px]" />
        <div className="absolute bottom-10 right-10 h-[500px] w-[500px] rounded-full bg-teal-500/[0.06] blur-[150px]" />
      </div>

      {/* Cabeçalho Superior */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card/50 to-background/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(73,93%,55%,0.15),_transparent_50%)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9f31d]/10 ring-1 ring-[#c9f31d]/30 shadow-[0_0_30px_rgba(201,243,29,0.3)] shrink-0">
            <Gift className="h-8 w-8 text-[#c9f31d]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-[#c9f31d]/10 text-[#c9f31d] border-[#c9f31d]/30 text-[10px] uppercase tracking-wider font-bold">
                Show de Prêmios
              </Badge>
              <span className="text-xs text-muted-foreground">· Experiência Imersiva</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Roleta de <span className="text-[#c9f31d]">Prêmios</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              Gire a roleta em tela cheia para revelar prêmios incríveis com contagem regressiva e efeitos de comemoração.
            </p>
          </div>
        </div>

        {/* Botões de Ação: Gerenciar Prêmios e Tela Cheia */}
        <div className="relative flex flex-wrap items-center gap-3 self-start sm:self-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-primary/40 hover:bg-primary/10 backdrop-blur-md h-12 px-6 rounded-2xl shadow-[0_0_20px_rgba(201,243,29,0.15)] gap-2.5 text-sm font-bold text-primary hover:text-primary transition-all hover:scale-105"
              >
                <Settings className="w-5 h-5" />
                Configurar Prêmios ({items.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-border/60 bg-card/95 backdrop-blur-2xl shadow-2xl max-h-[90vh] flex flex-col rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Gift className="w-6 h-6 text-[#c9f31d]" /> Gerenciar Lista de Prêmios
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 my-2 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex gap-2">
                  <Input
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Digite o nome do prêmio..."
                    className="bg-background/50 border-border/60 focus:ring-[#c9f31d] h-12 text-sm font-medium rounded-xl shadow-inner"
                  />
                  <Button onClick={addItem} className="bg-[#c9f31d] text-black hover:bg-[#a8de15] font-bold h-12 w-12 rounded-xl shrink-0 shadow-[0_0_15px_rgba(201,243,29,0.2)] transition-transform hover:scale-105">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar max-h-[50vh]">
                  {items.map((item, i) => {
                    const colorObj = SLICE_COLORS[i % SLICE_COLORS.length];
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3.5 hover:bg-secondary/40 transition-all group shadow-sm">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-4 w-4 rounded-full shrink-0 shadow-sm ring-2 ring-white/10" style={{ background: colorObj.bg }} />
                          <span className="text-sm font-bold text-foreground truncate">{item}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0" title="Remover prêmio">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                      <Gift className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground font-medium text-sm">Nenhum prêmio na lista.</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between border-t border-border/40 pt-4 mt-auto">
                <Button variant="outline" onClick={resetDefault} className="border-border hover:bg-secondary/60 w-full sm:w-auto gap-2 text-xs font-semibold h-11 rounded-xl">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" /> Restaurar Padrão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={toggleFullscreen}
            className="border-border hover:bg-secondary/60 backdrop-blur-md h-12 px-5 rounded-2xl shadow-sm gap-2 text-sm font-semibold transition-all hover:scale-105"
            title={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5 text-muted-foreground" /> : <Maximize className="w-5 h-5 text-muted-foreground" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
          </Button>
        </div>
      </div>

      {/* Área Central da Roleta Gigante */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[850px] mx-auto relative my-auto py-4 sm:py-8">
        <div className="w-full flex flex-col items-center justify-center p-4 sm:p-10 rounded-[3rem] border border-border/50 bg-card/20 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/40 pointer-events-none" />

          {/* Container Responsivo da Roleta Gigante */}
          <div className="relative w-full max-w-[750px] flex justify-center items-center my-4">
            {/* Ponteiro Gigante no Topo */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_8px_20px_rgba(201,243,29,0.9)] transition-transform duration-300 hover:scale-110">
              <svg width="68" height="84" viewBox="0 0 68 84" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M34 84L8 30C8 15.6406 19.6406 4 34 4C48.3594 4 60 15.6406 60 30L34 84Z" fill="#c9f31d" stroke="#0a0a0a" strokeWidth="6"/>
                <circle cx="34" cy="26" r="10" fill="#0a0a0a" stroke="#ffffff" strokeWidth="3"/>
              </svg>
            </div>

            {/* Sombra e Brilho atrás da Roleta */}
            <div className="absolute inset-0 rounded-full bg-[#c9f31d]/15 blur-[100px] -z-10 transform scale-95" />

            {/* Estrutura SVG da Roleta Gigante */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-auto aspect-square rounded-full filter drop-shadow-[0_16px_50px_rgba(0,0,0,0.7)] select-none"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)' : 'none',
              }}
            >
              {/* Borda Externa Grossa (Aro da Roleta) */}
              <circle cx={cx} cy={cy} r={outerRadius} fill="#0f0f0f" stroke="#27272a" strokeWidth="32" />
              <circle cx={cx} cy={cy} r={outerRadius} fill="none" stroke="#c9f31d" strokeWidth="6" opacity="0.8" />

              {/* Pinos Decorativos no Aro */}
              {studs.map((stud, idx) => (
                <circle
                  key={idx}
                  cx={stud.x}
                  cy={stud.y}
                  r={5}
                  fill={idx % 2 === 0 ? '#c9f31d' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2"
                />
              ))}

              {/* Fatias da Roleta */}
              {items.map((item, i) => {
                const colorObj = SLICE_COLORS[i % SLICE_COLORS.length];
                const { tx, ty, deg } = textTransform(i);
                return (
                  <g key={i}>
                    <path
                      d={slicePath(i)}
                      fill={colorObj.bg}
                      stroke="#0f0f0f"
                      strokeWidth="4"
                      className="transition-opacity duration-200 hover:opacity-95"
                    />
                    {items.length > 1 && (
                      <text
                        x={tx}
                        y={ty}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${deg}, ${tx}, ${ty})`}
                        fill={colorObj.text}
                        fontSize={items.length > 24 ? 14 : items.length > 16 ? 18 : 24}
                        fontWeight="900"
                        style={{ userSelect: 'none', pointerEvents: 'none', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))' }}
                      >
                        {item.length > 20 ? item.slice(0, 18) + '…' : item}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Centro da Roleta (Miolo) */}
              <circle cx={cx} cy={cy} r={48} fill="#0f0f0f" stroke="#c9f31d" strokeWidth="8" filter="drop-shadow(0 6px 16px rgba(0,0,0,0.6))" />
              <circle cx={cx} cy={cy} r={16} fill="#c9f31d" />
            </svg>

            {/* OVERLAY DE CONTAGEM REGRESSIVA (3, 2, 1, GO!) */}
            {countdown && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full animate-in fade-in duration-300">
                <div key={countdown} className="animate-in zoom-in-50 spin-in-12 fade-in duration-500 flex flex-col items-center justify-center">
                  <span className="text-[12rem] sm:text-[18rem] font-black text-[#c9f31d] tracking-tighter filter drop-shadow-[0_0_80px_rgba(201,243,29,0.9)] leading-none select-none">
                    {countdown}
                  </span>
                  {countdown === 'GO!' && (
                    <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-widest mt-4 animate-bounce uppercase select-none">
                      Boa sorte! 🚀
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* OVERLAY DE CELEBRAÇÃO DO VENCEDOR */}
            {winner && !spinning && !countdown && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md rounded-full animate-in fade-in zoom-in duration-500 p-6">
                <div className="relative max-w-xl w-full overflow-hidden rounded-[2.5rem] border-4 border-[#c9f31d] bg-gradient-to-r from-[#c9f31d]/20 via-background/95 to-background/95 p-8 sm:p-12 backdrop-blur-2xl shadow-[0_0_80px_rgba(201,243,29,0.5)] text-center space-y-6 animate-bounce-short">
                  <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#c9f31d]/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-[#c9f31d] text-black shadow-[0_0_40px_rgba(201,243,29,0.6)] animate-pulse">
                    <Trophy className="h-14 w-14" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-6 h-6 text-[#c9f31d]" />
                      <span className="text-sm sm:text-base font-extrabold text-[#c9f31d] uppercase tracking-widest">Parabéns! Prêmio Sorteado</span>
                      <Sparkles className="w-6 h-6 text-[#c9f31d]" />
                    </div>
                    <p className="text-3xl sm:text-5xl font-black text-white tracking-tight break-words py-2">{winner}</p>
                  </div>
                  <div className="pt-4 flex justify-center gap-4">
                    <Button
                      onClick={() => setWinner(null)}
                      className="bg-[#c9f31d] text-black hover:bg-[#a8de15] font-black text-xl px-10 py-8 rounded-2xl shadow-[0_0_35px_rgba(201,243,29,0.4)] transition-all hover:scale-105"
                    >
                      Girar Novamente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Girar Gigante */}
          <div className="mt-10 mb-4 z-10 w-full max-w-md">
            <Button
              onClick={startSpinFlow}
              disabled={spinning || !!countdown || items.length < 2}
              className="w-full bg-[#c9f31d] text-black hover:bg-[#a8de15] font-black text-2xl py-10 rounded-2xl shadow-[0_0_50px_rgba(201,243,29,0.5)] transition-all transform hover:scale-105 active:scale-95 gap-4 flex items-center justify-center border-4 border-black/10"
            >
              <RotateCcw className={cn('h-8 w-8 text-black', (spinning || countdown) && 'animate-spin')} />
              {spinning || countdown ? 'PREPARANDO O GIRO...' : 'GIRAR ROLETA!'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
