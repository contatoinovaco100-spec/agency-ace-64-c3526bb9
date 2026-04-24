import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, MessageCircle, Instagram as InstagramIcon, Globe, Search,
  Loader2, Building2, MapPin, Star, Plus,
} from 'lucide-react';
import {
  NICHES, POST_TYPE_LABELS, type RedePost, type RedePostType,
} from '@/types/rede';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

const PAGE_SIZE = 12;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function waLink(phone: string, msg: string) {
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function igLink(handle: string) {
  if (!handle) return '';
  if (handle.startsWith('http')) return handle;
  return `https://instagram.com/${handle.replace('@', '')}`;
}

export default function RedeNegociosPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [posts, setPosts] = useState<RedePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | RedePostType>('all');
  const [filterNiche, setFilterNiche] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('');

  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (pageIndex: number, replace = false) => {
    if (pageIndex === 0) setLoading(true); else setLoadingMore(true);

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('rede_posts')
      .select('*, company:rede_companies(*)', { count: 'exact' })
      .eq('is_hidden', false)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filterType !== 'all') query = query.eq('post_type', filterType);

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setLoading(false); setLoadingMore(false);
      return;
    }

    let rows = (data ?? []) as unknown as RedePost[];
    // client-side filters that depend on company
    if (filterNiche !== 'all') rows = rows.filter(p => p.company?.niche === filterNiche);
    if (filterCity.trim()) {
      const c = filterCity.trim().toLowerCase();
      rows = rows.filter(p => (p.company?.city || '').toLowerCase().includes(c));
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(p =>
        p.content.toLowerCase().includes(s) ||
        (p.company?.name || '').toLowerCase().includes(s) ||
        (p.company?.services || []).some(srv => srv.toLowerCase().includes(s)),
      );
    }

    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setPosts(prev => replace ? rows : [...prev, ...rows]);
    setLoading(false);
    setLoadingMore(false);
  }, [filterType, filterNiche, filterCity, search]);

  // reset on filter change
  useEffect(() => {
    setPage(0);
    fetchPage(0, true);
  }, [filterType, filterNiche, filterCity, search, fetchPage]);

  // infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore) {
        const next = page + 1;
        setPage(next);
        fetchPage(next);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, hasMore, loading, loadingMore, fetchPage]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel('rede_posts_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rede_posts' }, () => {
        setPage(0);
        fetchPage(0, true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPage]);

  const featuredCompanies = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof posts[number]['company'][] = [];
    for (const p of posts) {
      if (p.company && p.company.is_featured && !seen.has(p.company.id)) {
        seen.add(p.company.id);
        out.push(p.company);
        if (out.length >= 4) break;
      }
    }
    return out;
  }, [posts]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="border-b border-border/50 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 py-10 md:py-16 max-w-6xl">
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> INOVA
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Rede de Negócios <span className="text-primary">Inova</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base md:text-lg">
            Conectamos empresas prontas para gerar oportunidades e fazer negócios.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            {user ? (
              <Button asChild size="lg" className="gap-2">
                <Link to="/rede/perfil">
                  <Building2 className="h-4 w-4" /> Meu perfil
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/login">Entrar para publicar</Link>
              </Button>
            )}
            {user && (
              <Button asChild size="lg" variant="secondary" className="gap-2">
                <Link to="/rede/novo">
                  <Plus className="h-4 w-4" /> Publicar
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/rede/admin">Painel admin</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* FILTROS */}
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 max-w-6xl flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, serviço ou texto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | RedePostType)}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="atualizacao">Atualização</SelectItem>
              <SelectItem value="oferecendo">Oferecendo serviço</SelectItem>
              <SelectItem value="procurando">Procurando serviço</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterNiche} onValueChange={setFilterNiche}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder="Nicho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os nichos</SelectItem>
              {NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Cidade"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="md:w-40"
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* FEED */}
        <main className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhuma publicação encontrada com esses filtros.
            </Card>
          ) : (
            posts.map(p => <PostCard key={p.id} post={p} />)
          )}

          <div ref={loaderRef} className="py-8 flex justify-center">
            {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {!hasMore && posts.length > 0 && (
              <span className="text-xs text-muted-foreground">Você chegou ao fim do feed.</span>
            )}
          </div>
        </main>

        {/* SIDEBAR */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> Empresas em destaque
            </h3>
            {featuredCompanies.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma empresa em destaque ainda.</p>
            ) : (
              <ul className="space-y-3">
                {featuredCompanies.map(c => c && (
                  <li key={c.id} className="flex items-center gap-3">
                    <CompanyLogo url={c.logo_url} name={c.name} className="h-10 w-10" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.niche}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5 bg-primary/5 border-primary/20">
            <h3 className="font-semibold text-sm mb-2">Quer entrar na rede?</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Os perfis são curados pela equipe Inova. Fale com a gente para participar.
            </p>
            <Button asChild size="sm" className="w-full">
              <a
                href={waLink('5500000000000', 'Olá! Quero participar da Rede de Negócios Inova.')}
                target="_blank" rel="noreferrer"
              >
                Falar com a Inova
              </a>
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function CompanyLogo({ url, name, className = 'h-12 w-12' }: { url: string; name: string; className?: string }) {
  if (url) {
    return <img src={url} alt={name} className={`${className} rounded-full object-cover bg-muted`} />;
  }
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className={`${className} rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center`}>
      {initials}
    </div>
  );
}

function PostCard({ post }: { post: RedePost }) {
  const c = post.company;
  if (!c) return null;
  const typeColor: Record<RedePostType, string> = {
    atualizacao: 'bg-secondary text-secondary-foreground',
    oferecendo: 'bg-primary/15 text-primary border border-primary/30',
    procurando: 'bg-accent text-accent-foreground',
  };

  return (
    <Card className={`p-5 transition-shadow hover:shadow-lg ${post.is_featured ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}>
      <header className="flex items-start gap-3">
        <CompanyLogo url={c.logo_url} name={c.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{c.name}</h3>
            {post.is_featured && (
              <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                <Star className="h-3 w-3" /> Destaque
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
            {c.niche && <span>{c.niche}</span>}
            {c.city && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span></>}
            <span>·</span>
            <span>{formatDate(post.created_at)}</span>
          </div>
        </div>
        <Badge className={typeColor[post.post_type]}>{POST_TYPE_LABELS[post.post_type]}</Badge>
      </header>

      {post.content && (
        <p className="mt-4 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
      )}

      {post.media_url && post.media_type === 'image' && (
        <img src={post.media_url} alt="" className="mt-4 rounded-lg w-full object-cover max-h-[480px] bg-muted" />
      )}
      {post.media_url && post.media_type === 'video' && (
        <video src={post.media_url} controls className="mt-4 rounded-lg w-full max-h-[480px] bg-black" />
      )}

      <footer className="mt-4 flex flex-wrap gap-2">
        {c.whatsapp && (
          <Button asChild size="sm" className="gap-2">
            <a
              href={waLink(c.whatsapp, `Olá ${c.name}! Vi sua publicação na Rede de Negócios Inova.`)}
              target="_blank" rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
        )}
        {c.instagram && (
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={igLink(c.instagram)} target="_blank" rel="noreferrer">
              <InstagramIcon className="h-4 w-4" /> Instagram
            </a>
          </Button>
        )}
        {c.website && (
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">
              <Globe className="h-4 w-4" /> Site
            </a>
          </Button>
        )}
      </footer>
    </Card>
  );
}
