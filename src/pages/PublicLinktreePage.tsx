import { useEffect, useState } from 'react';
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

interface ProfileRow {
  display_name: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
}

export default function PublicLinktreePage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'INOVA Co. — Links';
    (async () => {
      const [linksRes, profileRes] = await Promise.all([
        supabase.from('linktree_links').select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('linktree_profile').select('*').eq('id', 1).maybeSingle(),
      ]);
      setLinks((linksRes.data as LinkRow[]) || []);
      setProfile((profileRes.data as ProfileRow) || null);
      setLoading(false);
    })();
  }, []);

  const handleClick = async (link: LinkRow) => {
    // fire-and-forget click counter
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-8">
        {/* Profile */}
        <div className="text-center space-y-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="h-24 w-24 rounded-full mx-auto object-cover ring-4 ring-primary/30"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/20 ring-4 ring-primary/30 flex items-center justify-center mx-auto text-4xl">
              {profile?.avatar_emoji || '🎬'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{profile?.display_name || 'INOVA Co.'}</h1>
            <p className="text-sm text-muted-foreground mt-1">{profile?.bio || 'Produtora Audiovisual'}</p>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum link disponível.</p>
          ) : (
            links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleClick(link)}
                className="flex items-center gap-3 w-full px-5 py-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/10 hover:scale-[1.02] transition-all group shadow-sm"
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="flex-1 font-medium text-foreground text-sm text-left">{link.title}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-8">
          © {new Date().getFullYear()} {profile?.display_name || 'INOVA Co.'}
        </p>
      </div>
    </div>
  );
}
