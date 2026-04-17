import { useState } from 'react';
import { Link2, Plus, Trash2, Eye, GripVertical, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LinkItem { id: string; title: string; url: string; active: boolean; icon: string; }

const DEFAULT_LINKS: LinkItem[] = [
  { id:'1', title:'Instagram', url:'https://instagram.com/inovaco100', active:true, icon:'📸' },
  { id:'2', title:'YouTube', url:'https://youtube.com/@inovaco100', active:true, icon:'▶️' },
  { id:'3', title:'WhatsApp', url:'https://wa.me/5562999999999', active:true, icon:'💬' },
  { id:'4', title:'Site', url:'https://inovaco.com.br', active:true, icon:'🌐' },
  { id:'5', title:'Portfólio', url:'https://agency-ace-64.lovable.app/vitrine', active:true, icon:'🎬' },
];

export default function LinktreePage() {
  const [links, setLinks] = useState<LinkItem[]>(DEFAULT_LINKS);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ title:'', url:'', icon:'🔗' });
  const LINKTREE_URL = 'https://agency-ace-64.lovable.app/links';

  const addLink = () => {
    if (!form.title || !form.url) return;
    setLinks(l => [...l, { id: crypto.randomUUID(), ...form, active: true }]);
    setForm({ title:'', url:'', icon:'🔗' });
  };

  const toggleLink = (id: string) => setLinks(l => l.map(x => x.id===id ? {...x, active: !x.active} : x));
  const removeLink = (id: string) => setLinks(l => l.filter(x => x.id !== id));

  const copyUrl = () => {
    navigator.clipboard.writeText(LINKTREE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeLinks = links.filter(l => l.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Link2 className="h-6 w-6 text-primary" /> Linktree</h1>
          <p className="text-muted-foreground text-sm mt-1">Centralize todos os seus links em um só lugar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyUrl} className="flex items-center gap-2">
            {copied ? <CheckCheck className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </Button>
          <Button onClick={() => setPreview(!preview)} variant={preview ? 'default' : 'outline'} className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> {preview ? 'Editar' : 'Pré-visualizar'}
          </Button>
        </div>
      </div>

      {preview ? (
        /* Preview */
        <div className="flex justify-center py-8">
          <div className="w-80 space-y-4 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto text-3xl">🎬</div>
            <div>
              <h2 className="text-xl font-bold text-foreground">INOVA Co.</h2>
              <p className="text-sm text-muted-foreground">Produtora Audiovisual</p>
            </div>
            <div className="space-y-3">
              {activeLinks.map(link => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group">
                  <span className="text-xl">{link.icon}</span>
                  <span className="flex-1 font-medium text-foreground text-sm text-left">{link.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Editor */
        <div className="grid md:grid-cols-[1fr,300px] gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Adicionar Link</h3>
              <div className="grid grid-cols-[60px,1fr,1fr] gap-2">
                <div><Label className="text-xs">Ícone</Label><Input value={form.icon} onChange={e => setForm(f=>({...f,icon:e.target.value}))} className="mt-1 text-center text-lg" maxLength={2} /></div>
                <div><Label className="text-xs">Título</Label><Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Instagram" className="mt-1" /></div>
                <div><Label className="text-xs">URL</Label><Input value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))} placeholder="https://..." className="mt-1" /></div>
              </div>
              <Button onClick={addLink} className="w-full flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>

            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {links.map(link => (
                <div key={link.id} className={cn('flex items-center gap-3 px-4 py-3', !link.active && 'opacity-50')}>
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <span className="text-xl">{link.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{link.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <Switch checked={link.active} onCheckedChange={() => toggleLink(link.id)} />
                  <button onClick={() => removeLink(link.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3">Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Links ativos</span><Badge className="bg-primary/10 text-primary">{activeLinks.length}</Badge></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Links inativos</span><Badge variant="outline">{links.length - activeLinks.length}</Badge></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold text-foreground">{links.length}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-2">Seu Link</h3>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{LINKTREE_URL}</span>
              </div>
              <Button onClick={copyUrl} variant="outline" size="sm" className="w-full mt-2 text-xs">
                {copied ? '✓ Copiado!' : 'Copiar URL'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
