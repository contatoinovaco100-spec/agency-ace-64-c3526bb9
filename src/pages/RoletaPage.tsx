import { useState, useRef } from 'react';
import { Gift, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const COLORS = ['#c9f31d','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#3b82f6','#10b981','#f97316'];

const DEFAULT_ITEMS = ['🏆 Meta Batida!','🎁 Bônus Surpresa','📈 Dia de Folga','🍕 Almoço da Equipe','💰 Comissão Extra','🎯 Próximo Nível','⭐ Destaque do Mês','🚀 Projeto Especial'];

export default function RoletaPage() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [newItem, setNewItem] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string|null>(null);
  const spinRef = useRef(0);

  const addItem = () => {
    if (newItem.trim()) { setItems(it => [...it, newItem.trim()]); setNewItem(''); }
  };

  const removeItem = (i: number) => setItems(it => it.filter((_,idx) => idx !== i));

  const spin = () => {
    if (spinning || items.length < 2) return;
    setWinner(null);
    setSpinning(true);
    const extra = 1440 + Math.floor(Math.random() * 720);
    const newRot = spinRef.current + extra;
    spinRef.current = newRot;
    setRotation(newRot);
    setTimeout(() => {
      setSpinning(false);
      const sliceAngle = 360 / items.length;
      const normalized = ((newRot % 360) + 360) % 360;
      const winnerIdx = Math.floor((360 - normalized) / sliceAngle) % items.length;
      setWinner(items[winnerIdx]);
    }, 4000);
  };

  const size = 300;
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const sliceAngle = (2 * Math.PI) / items.length;

  const slicePath = (i: number) => {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  };

  const textTransform = (i: number) => {
    const angle = (i + 0.5) * sliceAngle - Math.PI / 2;
    const tx = cx + (r * 0.62) * Math.cos(angle);
    const ty = cy + (r * 0.62) * Math.sin(angle);
    const deg = ((i + 0.5) * (360 / items.length)) - 90;
    return { tx, ty, deg };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Gift className="h-6 w-6 text-primary" /> Roleta de Prêmios</h1>
        <p className="text-muted-foreground text-sm mt-1">Gamificação para motivar sua equipe</p>
      </div>

      <div className="grid md:grid-cols-[1fr,300px] gap-8 items-start">
        {/* Wheel */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative" style={{ width: size, height: size }}>
            {/* Pointer */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 w-0 h-0" style={{ borderLeft:'12px solid transparent', borderRight:'12px solid transparent', borderTop:'28px solid #c9f31d' }} />
            <svg
              width={size} height={size}
              style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none', borderRadius: '50%', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}
            >
              {items.map((item, i) => {
                const { tx, ty, deg } = textTransform(i);
                return (
                  <g key={i}>
                    <path d={slicePath(i)} fill={COLORS[i % COLORS.length]} stroke="#0a0a0a" strokeWidth="1.5" />
                    <text
                      x={tx} y={ty}
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${deg}, ${tx}, ${ty})`}
                      fill="#000" fontSize={items.length > 6 ? 9 : 11} fontWeight="700"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {item.length > 14 ? item.slice(0,12)+'…' : item}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={18} fill="#0a0a0a" stroke="#c9f31d" strokeWidth="3" />
            </svg>
          </div>

          <Button onClick={spin} disabled={spinning || items.length < 2} size="lg" className="px-10 text-base font-bold gap-2">
            <RotateCcw className={cn('h-5 w-5', spinning && 'animate-spin')} />
            {spinning ? 'Girando...' : 'GIRAR!'}
          </Button>

          {winner && (
            <div className="text-center animate-bounce">
              <div className="rounded-2xl border-2 border-primary bg-primary/10 px-8 py-5">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">🎉 Resultado</p>
                <p className="text-2xl font-black text-primary">{winner}</p>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Prêmios ({items.length})</h3>
          <div className="flex gap-2">
            <Input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key==='Enter' && addItem()} placeholder="Novo prêmio..." className="flex-1 text-sm" />
            <Button size="icon" onClick={addItem}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50 group">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-foreground flex-1 truncate">{item}</span>
                <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
