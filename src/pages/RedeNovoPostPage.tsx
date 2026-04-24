import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Image as ImageIcon, Video, X, ArrowLeft } from 'lucide-react';
import { type RedeCompany, containsForbidden } from '@/types/rede';
import { Link } from 'react-router-dom';

export default function RedeNovoPostPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [company, setCompany] = useState<RedeCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav('/login'); return; }
    supabase
      .from('rede_companies')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCompany(data as unknown as RedeCompany | null);
        setLoading(false);
      });
  }, [user, authLoading, nav]);

  function onPickFile(f: File | null) {
    if (!f) { setFile(null); setPreview(''); return; }
    if (f.size > 25 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 25MB).');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (!user || !company) return;
    if (!content.trim() && !file) {
      toast.error('Escreva algo ou anexe uma mídia.');
      return;
    }
    const forbidden = containsForbidden(content);
    if (forbidden) {
      toast.error(`Termo não permitido: "${forbidden}". A Rede não aceita posts de marketing.`);
      return;
    }
    setSaving(true);

    let media_url = '';
    let media_type: '' | 'image' | 'video' = '';

    if (file) {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('rede-media').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) {
        toast.error('Falha no upload: ' + upErr.message);
        setSaving(false); return;
      }
      const { data: pub } = supabase.storage.from('rede-media').getPublicUrl(path);
      media_url = pub.publicUrl;
      media_type = file.type.startsWith('video') ? 'video' : 'image';
    }

    const { error } = await supabase.from('rede_posts').insert({
      company_id: company.id,
      author_user_id: user.id,
      content: content.trim(),
      media_url,
      media_type,
      post_type: 'atualizacao',
    });

    if (error) {
      toast.error(error.message);
      setSaving(false); return;
    }
    toast.success('Publicação criada!');
    nav('/negocios');
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h2 className="font-semibold text-lg mb-2">Você ainda não tem um perfil de empresa</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Os perfis da Rede de Negócios Inova são criados pela equipe Inova. Fale com a gente para entrar na rede.
          </p>
          <Button asChild><Link to="/negocios">Voltar para o feed</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
          <Link to="/negocios"><ArrowLeft className="h-4 w-4" /> Voltar para o feed</Link>
        </Button>
        <Card className="p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Nova publicação</h1>
            <p className="text-sm text-muted-foreground">Publicando como <span className="text-foreground font-medium">{company.name}</span></p>
          </div>

          <div className="space-y-2">
            <Label>Texto</Label>
            <Textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Conte sua novidade, oportunidade ou serviço…"
              maxLength={1500}
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/1500</p>
          </div>

          <div className="space-y-2">
            <Label>Mídia (opcional, imagem ou vídeo até 25MB)</Label>
            {preview ? (
              <div className="relative">
                {file?.type.startsWith('video') ? (
                  <video src={preview} controls className="w-full rounded-lg max-h-80 bg-black" />
                ) : (
                  <img src={preview} alt="" className="w-full rounded-lg max-h-80 object-cover bg-muted" />
                )}
                <Button
                  type="button" size="icon" variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => onPickFile(null)}
                ><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <Video className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para anexar imagem ou vídeo</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/negocios">Cancelar</Link></Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Publicar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            ⚠️ A Rede de Negócios Inova é focada em <strong>serviços complementares</strong>. Posts oferecendo serviços de marketing, social media ou tráfego pago não são permitidos.
          </p>
        </Card>
      </div>
    </div>
  );
}
