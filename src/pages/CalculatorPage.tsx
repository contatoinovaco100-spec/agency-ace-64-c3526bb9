import { useState } from 'react';
import { Calculator, Plus, Trash2, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ServiceItem { id: string; name: string; qty: number; unit: number; }

const PRESETS = [
  { name: 'Vídeo Institucional', unit: 3500 },
  { name: 'Reels (pacote 4)', unit: 1200 },
  { name: 'Podcast Mensal', unit: 2800 },
  { name: 'Gestão de Redes', unit: 2000 },
  { name: 'Story Pack (20)', unit: 800 },
  { name: 'Foto de Produto', unit: 600 },
  { name: 'Consultoria Estratégica', unit: 500 },
  { name: 'Motion Graphics', unit: 1500 },
];

const DISCOUNTS = [0, 5, 10, 15, 20];

export default function CalculatorPage() {
  const [items, setItems] = useState<ServiceItem[]>([
    { id: '1', name: 'Reels (pacote 4)', qty: 1, unit: 1200 },
    { id: '2', name: 'Gestão de Redes', qty: 1, unit: 2000 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [hours, setHours] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(150);
  const [mode, setMode] = useState<'pacotes'|'hora'>('pacotes');

  const addItem = () => setItems(it => [...it, { id: crypto.randomUUID(), name: 'Serviço Custom', qty: 1, unit: 1000 }]);
  const removeItem = (id: string) => setItems(it => it.filter(x => x.id !== id));
  const updateItem = (id: string, field: keyof ServiceItem, val: any) => setItems(it => it.map(x => x.id===id ? {...x, [field]: val} : x));

  const subtotal = mode==='pacotes' ? items.reduce((a,i) => a + i.qty * i.unit, 0) : hours * hourlyRate;
  const discountAmt = subtotal * (discount / 100);
  const total = subtotal - discountAmt;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /> Calculadora</h1>
        <p className="text-muted-foreground text-sm mt-1">Calcule o valor dos seus serviços</p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-card">
        {(['pacotes','hora'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('flex-1 py-2.5 text-sm font-medium transition-colors', mode===m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {m==='pacotes' ? '📦 Por Pacotes' : '⏱️ Por Hora'}
          </button>
        ))}
      </div>

      {mode==='pacotes' ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Serviços</h2>
            <Button size="sm" onClick={addItem} variant="outline" className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
          </div>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr,80px,120px,auto] gap-2 items-center">
                <Select value={item.name} onValueChange={v => {
                  const preset = PRESETS.find(p => p.name === v);
                  updateItem(item.id, 'name', v);
                  if (preset) updateItem(item.id, 'unit', preset.unit);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESETS.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    <SelectItem value="Serviço Custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={item.qty} onChange={e => updateItem(item.id,'qty',Number(e.target.value))} min={1} className="text-center" />
                <Input type="number" value={item.unit} onChange={e => updateItem(item.id,'unit',Number(e.target.value))} min={0} />
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 text-xs text-muted-foreground px-1">
            <span>Serviço</span><span className="text-center">Qtd</span><span>Valor unit.</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-2 gap-4">
          <div><Label>Horas estimadas</Label><Input type="number" value={hours} onChange={e=>setHours(Number(e.target.value))} min={1} className="mt-1" /></div>
          <div><Label>Valor por hora (R$)</Label><Input type="number" value={hourlyRate} onChange={e=>setHourlyRate(Number(e.target.value))} min={0} className="mt-1" /></div>
        </div>
      )}

      {/* Discount */}
      <div className="rounded-xl border border-border bg-card p-5">
        <Label className="mb-2 block">Desconto</Label>
        <div className="flex gap-2">
          {DISCOUNTS.map(d => (
            <button key={d} onClick={() => setDiscount(d)}
              className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                discount===d ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              )}>
              {d}%
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Resumo</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-green-400"><span>Desconto ({discount}%)</span><span>- {fmt(discountAmt)}</span></div>}
          <Separator />
          <div className="flex justify-between text-foreground font-bold text-lg"><span>Total</span><span className="text-primary">{fmt(total)}</span></div>
        </div>
        <Button className="w-full mt-2">Gerar Proposta com este Valor</Button>
      </div>
    </div>
  );
}
