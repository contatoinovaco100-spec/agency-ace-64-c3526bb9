import { useState, useRef } from 'react';
import { Gift, Plus, Trash2, RotateCcw, Trophy, Sparkles, RefreshCw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const spinRef = useRef(0);

  const addItem = () => {
    if (!newItem.trim()) return;
    if (items.length >= 24) {
      toast({ title: 'Limite atingido', description: 'A roleta suporta no máximo 24 prêmios.', variant: 'destructive' });
      return;
    }
    setItems(it => [...it, newItem.trim()]);
    setNewItem('');
    toast({ title: 'Prêmio adicionado!' });
  };

  const removeItem = (i: number) => {
    setItems(it => it.filter((_, idx) => idx !== i));
  };

  const resetDefault = () => {
    setItems(DEFAULT_ITEMS);
    setWinner(null);
    toast({ title: 'Prêmios padrão restaurados!' });
  };

  const spin = () => {
    if (spinning || items.length < 2) return;
    setWinner(null);
    setSpinning(true);

    // Gira entre 4 e 7 voltas completas + um ângulo aleatório
    const extraSpins = 1800 + Math.floor(Math.random() * 1080);
    const newRot = spinRef.current + extraSpins;
    spinRef.current = newRot;
    setRotation(newRot);

    setTimeout(() => {
      setSpinning(false);
      const sliceAngle = 360 / items.length;
      const normalized = ((newRot % 360) + 360) % 360;
      // O ponteiro está no topo (270 graus ou -90 graus no círculo trigonométrico)
      // Como o SVG gira no sentido horário, calculamos o índice que parou no topo
      const winnerIdx = Math.floor((360 - normalized) / sliceAngle) % items.length;
      const wonItem = items[winnerIdx];
      setWinner(wonItem);
      toast({
        title: '🎉 Temos um vencedor!',
        description: `Prêmio sorteado: ${wonItem}`,
      });
    }, 4500);
  };

  // Coordenadas e dimensões do SVG (viewBox 540x540 para altíssima resolução)
  const size = 540;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 12; // 258
  const r = outerRadius - 16; // 242 (deixa espaço para a borda externa decorada)

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
    // Flag de arco grande caso tenha apenas 2 itens (ângulo de 180 graus)
    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  const textTransform = (i: number) => {
    const angle = (i + 0.5) * sliceAngle - Math.PI / 2;
    // Posiciona o texto a 65% do raio
    const tx = cx + (r * 0.68) * Math.cos(angle);
    const ty = cy + (r * 0.68) * Math.sin(angle);
    const deg = ((i + 0.5) * (360 / items.length)) - 90;
    return { tx, ty, deg };
  };

  // Pinos/Lâmpadas decorativas ao redor da roleta
  const studs = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360 / 24) * (Math.PI / 180);
    return {
      x: cx + outerRadius * Math.cos(angle),
      y: cy + outerRadius * Math.sin(angle),
    };
  });

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Background ambiente com brilhos premium */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#c9f31d]/[0.08] blur-[150px]" />
        <div className="absolute top-1/3 -left-20 h-[400px] w-[400px] rounded-full bg-purple-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-10 right-10 h-[400px] w-[400px] rounded-full bg-teal-500/[0.06] blur-[120px]" />
      </div>

      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card/50 to-background/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(73,93%,55%,0.15),_transparent_50%)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9f31d]/10 ring-1 ring-[#c9f31d]/30 shadow-[0_0_30px_rgba(201,243,29,0.3)]">
            <Gift className="h-8 w-8 text-[#c9f31d]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-[#c9f31d]/10 text-[#c9f31d] border-[#c9f31d]/30 text-[10px] uppercase tracking-wider font-bold">
                Gamificação Premium
              </Badge>
              <span className="text-xs text-muted-foreground">· Sorteio Interativo</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Roleta de <span className="text-[#c9f31d]">Prêmios</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              Engaje e recompense sua equipe ou clientes com prêmios instantâneos. Personalize os itens e gire a roleta!
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-3 self-start sm:self-center">
          <Button
            variant="outline"
            onClick={resetDefault}
            className="border-border hover:bg-secondary/60 backdrop-blur-md h-11 px-4 rounded-xl shadow-sm gap-2 text-xs sm:text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            Restaurar Padrão
          </Button>
        </div>
      </div>

      {/* Grid Principal: Roleta (Esquerda) e Prêmios (Direita) */}
      <div className="grid lg:grid-cols-[1fr,420px] gap-8 lg:gap-12 items-start">
        {/* Lado Esquerdo: A Roleta */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 rounded-3xl border border-border/50 bg-card/20 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/40 pointer-events-none" />

          {/* Container Responsivo da Roleta */}
          <div className="relative w-full max-w-[540px] flex justify-center items-center my-4">
            {/* Ponteiro Premium no Topo */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_6px_16px_rgba(201,243,29,0.8)] transition-transform duration-300 hover:scale-110">
              <svg width="56" height="68" viewBox="0 0 56 68" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M28 68L6 24C6 11.8497 15.8497 2 28 2C40.1503 2 50 11.8497 50 24L28 68Z" fill="#c9f31d" stroke="#0a0a0a" strokeWidth="4"/>
                <circle cx="28" cy="22" r="8" fill="#0a0a0a" stroke="#ffffff" strokeWidth="2"/>
              </svg>
            </div>

            {/* Sombra e Brilho atrás da Roleta */}
            <div className="absolute inset-0 rounded-full bg-[#c9f31d]/10 blur-[80px] -z-10 transform scale-90" />

            {/* Estrutura SVG da Roleta */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-auto aspect-square rounded-full filter drop-shadow-[0_12px_40px_rgba(0,0,0,0.6)] select-none"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4.5s cubic-bezier(0.2, 0.8, 0.1, 1)' : 'none',
              }}
            >
              {/* Borda Externa Grossa (Aro da Roleta) */}
              <circle cx={cx} cy={cy} r={outerRadius} fill="#0f0f0f" stroke="#27272a" strokeWidth="24" />
              <circle cx={cx} cy={cy} r={outerRadius} fill="none" stroke="#c9f31d" strokeWidth="4" opacity="0.8" />

              {/* Pinos Decorativos no Aro */}
              {studs.map((stud, idx) => (
                <circle
                  key={idx}
                  cx={stud.x}
                  cy={stud.y}
                  r={4}
                  fill={idx % 2 === 0 ? '#c9f31d' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth="1.5"
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
                      strokeWidth="3"
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
                        fontSize={items.length > 16 ? 12 : items.length > 10 ? 15 : 18}
                        fontWeight="800"
                        style={{ userSelect: 'none', pointerEvents: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                      >
                        {item.length > 18 ? item.slice(0, 16) + '…' : item}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Centro da Roleta (Miolo) */}
              <circle cx={cx} cy={cy} r={38} fill="#0f0f0f" stroke="#c9f31d" strokeWidth="6" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))" />
              <circle cx={cx} cy={cy} r={12} fill="#c9f31d" />
            </svg>
          </div>

          {/* Botão de Girar */}
          <div className="mt-8 mb-4 z-10 w-full max-w-xs">
            <Button
              onClick={spin}
              disabled={spinning || items.length < 2}
              className="w-full bg-[#c9f31d] text-black hover:bg-[#a8de15] font-black text-xl py-8 rounded-2xl shadow-[0_0_40px_rgba(201,243,29,0.4)] transition-all transform hover:scale-105 active:scale-95 gap-3 flex items-center justify-center border-2 border-black/10"
            >
              <RotateCcw className={cn('h-7 w-7 text-black', spinning && 'animate-spin')} />
              {spinning ? 'GIRANDO A ROLETA...' : 'GIRAR ROLETA!'}
            </Button>
          </div>

          {/* Card de Celebração do Vencedor */}
          {winner && !spinning && (
            <div className="w-full mt-6 animate-in zoom-in-95 duration-500">
              <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9f31d] bg-gradient-to-r from-[#c9f31d]/20 via-[#c9f31d]/10 to-transparent p-6 backdrop-blur-xl shadow-[0_0_30px_rgba(201,243,29,0.2)] flex items-center gap-6">
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[#c9f31d]/20 rounded-full blur-2xl pointer-events-none" />
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9f31d] text-black shadow-lg shrink-0 animate-bounce">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-[#c9f31d]" />
                    <span className="text-xs font-bold text-[#c9f31d] uppercase tracking-widest">Prêmio Sorteado</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">{winner}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Gestão de Prêmios */}
        <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[650px]">
          <CardHeader className="border-b border-border/40 bg-card/20 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#c9f31d]" /> Lista de Prêmios
              </CardTitle>
              <Badge variant="secondary" className="bg-secondary/80 font-bold text-sm px-2.5 py-0.5 rounded-lg">
                {items.length} / 24
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Adicione, remova ou edite os prêmios da roleta</p>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col min-h-0 space-y-6">
            {/* Adicionar Novo Prêmio */}
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Digite o nome do prêmio..."
                className="bg-background/50 border-border/60 focus:ring-[#c9f31d] h-12 text-sm font-medium rounded-xl shadow-inner"
              />
              <Button
                onClick={addItem}
                className="bg-[#c9f31d] text-black hover:bg-[#a8de15] font-bold h-12 w-12 rounded-xl shadow-[0_0_15px_rgba(201,243,29,0.2)] shrink-0 transition-transform hover:scale-105"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {/* Lista com Scroll */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
              {items.map((item, i) => {
                const colorObj = SLICE_COLORS[i % SLICE_COLORS.length];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3.5 hover:bg-secondary/40 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="h-4 w-4 rounded-full shrink-0 shadow-sm ring-2 ring-white/10"
                        style={{ background: colorObj.bg }}
                      />
                      <span className="text-sm font-bold text-foreground truncate">{item}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(i)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Remover prêmio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                  <Gift className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-medium text-sm">Nenhum prêmio na lista.</p>
                  <Button variant="link" onClick={resetDefault} className="text-[#c9f31d] text-xs mt-1 p-0">
                    Restaurar prêmios padrão
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
