import { useState } from 'react';
import { Images, Play, Upload, Search, Filter, Film, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MediaItem { id: string; title: string; type: 'video'|'image'; thumbnail: string; client: string; date: string; tag: string; }

const MOCK: MediaItem[] = [
  { id:'1', title:'Vídeo Institucional Alfa', type:'video', thumbnail:'', client:'Alfa Tech', date:'2026-04-15', tag:'institucional' },
  { id:'2', title:'Reels Instagram Beta', type:'video', thumbnail:'', client:'Beta Store', date:'2026-04-14', tag:'reels' },
  { id:'3', title:'Fotos de Produto Gamma', type:'image', thumbnail:'', client:'Gamma Foods', date:'2026-04-13', tag:'produto' },
  { id:'4', title:'Vídeo Depoimento Delta', type:'video', thumbnail:'', client:'Delta Corp', date:'2026-04-12', tag:'depoimento' },
  { id:'5', title:'Stories Campanha Épsilon', type:'video', thumbnail:'', client:'Épsilon', date:'2026-04-11', tag:'stories' },
  { id:'6', title:'Foto Institucional Zeta', type:'image', thumbnail:'', client:'Zeta', date:'2026-04-10', tag:'institucional' },
];

const TAG_COLORS: Record<string, string> = {
  institucional: 'bg-blue-500/20 text-blue-400',
  reels: 'bg-pink-500/20 text-pink-400',
  produto: 'bg-green-500/20 text-green-400',
  depoimento: 'bg-yellow-500/20 text-yellow-400',
  stories: 'bg-purple-500/20 text-purple-400',
};

const GRAD_COLORS = [
  'from-blue-900 to-blue-700',
  'from-purple-900 to-purple-700',
  'from-green-900 to-green-700',
  'from-yellow-900 to-yellow-700',
  'from-pink-900 to-pink-700',
  'from-indigo-900 to-indigo-700',
];

export default function GalleryPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selected, setSelected] = useState<MediaItem|null>(null);

  const filtered = MOCK.filter(m =>
    (type==='all' || m.type===type) &&
    (m.title.toLowerCase().includes(search.toLowerCase()) || m.client.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Images className="h-6 w-6 text-primary" /> Galeria</h1>
          <p className="text-muted-foreground text-sm mt-1">{MOCK.length} arquivos de mídia</p>
        </div>
        <Button className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título ou cliente..." className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="video">Vídeos</SelectItem>
            <SelectItem value="image">Imagens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((item, idx) => (
          <div key={item.id} onClick={() => setSelected(item)}
            className="group rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5">
            <div className={cn('h-40 bg-gradient-to-br flex items-center justify-center relative', GRAD_COLORS[idx % GRAD_COLORS.length])}>
              {item.type==='video' ? <Film className="h-12 w-12 text-white/30" /> : <ImageIcon className="h-12 w-12 text-white/30" />}
              {item.type==='video' && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.client}</p>
              <div className="flex items-center justify-between mt-2">
                <Badge className={cn('text-xs', TAG_COLORS[item.tag] || 'bg-muted text-muted-foreground')}>{item.tag}</Badge>
                <span className="text-xs text-muted-foreground">{item.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Images className="h-12 w-12 mb-3 opacity-20" />
          <p>Nenhum arquivo encontrado.</p>
        </div>
      )}

      {/* Preview Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className={cn('h-48 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4', GRAD_COLORS[MOCK.indexOf(selected) % GRAD_COLORS.length])}>
              {selected.type==='video' ? <Film className="h-16 w-16 text-white/30" /> : <ImageIcon className="h-16 w-16 text-white/30" />}
            </div>
            <h3 className="font-semibold text-foreground text-lg">{selected.title}</h3>
            <p className="text-muted-foreground text-sm mt-1">Cliente: {selected.client}</p>
            <p className="text-muted-foreground text-sm">Data: {selected.date}</p>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
