import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LinkRow {
  id: string;
  title: string;
  url: string;
  icon: string;
  active: boolean;
  sort_order: number;
  clicks: number;
}

interface Linktree {
  id: string;
  slug: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  avatar_emoji: string;
  theme: string;
  bg_color: string;
  button_color: string;
  button_text_color: string;
  text_color: string;
  border_color: string;
  button_style: string;
}

export default function PublicLinktreePage() {
  const { slug } = useParams<{ slug: string }>();
  const [linktree, setLinktree] = useState<Linktree | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    document.title = 'Links';
    (async () => {
      const { data: lt } = await supabase
        .from('linktrees')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!lt) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLinktree(lt as Linktree);
      document.title = `${lt.display_name || 'Links'} — Links`;

      const { data: linksData } = await supabase
        .from('linktree_links')
        .select('*')
        .eq('linktree_id', lt.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      setLinks((linksData as LinkRow[]) || []);
      setLoading(false);
    })();
  }, [slug]);

  const handleClick = (link: LinkRow) => {
    supabase
      .from('linktree_links')
      .update({ clicks: (link.clicks || 0) + 1 })
      .eq('id', link.id)
      .then(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !linktree) {
    return <Navigate to="/links/inova" replace />;
  }

  const radius = linktree.button_style === 'pill' ? '9999px' : linktree.button_style === 'square' ? '4px' : '12px';

  return (
    <div
      className="min-h-screen px-4 py-12 transition-colors"
      style={{ background: linktree.bg_color, color: linktree.text_color }}
    >
      <div className="mx-auto w-full max-w-md space-y-8">
        {/* Profile */}
        <div className="text-center space-y-4">
          {linktree.avatar_url ? (
            <img
              src={linktree.avatar_url}
              alt={linktree.display_name}
              className="h-24 w-24 rounded-full mx-auto object-cover"
              style={{ boxShadow: `0 0 0 4px ${linktree.button_color}40` }}
            />
          ) : (
            <div
              className="h-24 w-24 rounded-full flex items-center justify-center mx-auto text-4xl"
              style={{ background: `${linktree.button_color}20`, boxShadow: `0 0 0 4px ${linktree.button_color}40` }}
            >
              {linktree.avatar_emoji || '🎬'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: linktree.text_color }}>
              {linktree.display_name}
            </h1>
            {linktree.bio && (
              <p className="text-sm mt-1 opacity-80" style={{ color: linktree.text_color }}>
                {linktree.bio}
              </p>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.length === 0 ? (
            <p className="text-center text-sm opacity-60 py-12">Nenhum link disponível.</p>
          ) : (
            links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleClick(link)}
                className="flex items-center gap-3 w-full px-5 py-4 transition-all hover:scale-[1.02] hover:opacity-90 group"
                style={{
                  background: linktree.button_color,
                  color: linktree.button_text_color,
                  border: `1px solid ${linktree.border_color}`,
                  borderRadius: radius,
                }}
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="flex-1 font-medium text-sm text-left">{link.title}</span>
                <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
            ))
          )}
        </div>

        <p className="text-center text-xs opacity-50 pt-8">
          © {new Date().getFullYear()} {linktree.display_name}
        </p>
      </div>
    </div>
  );
}
