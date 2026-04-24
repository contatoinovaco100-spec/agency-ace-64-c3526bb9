import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Loader2, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CommentRow {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function PostInteractions({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // initial counters
  useEffect(() => {
    let alive = true;
    (async () => {
      const [likes, cmts] = await Promise.all([
        supabase.from('rede_post_likes').select('user_id', { count: 'exact' }).eq('post_id', postId),
        supabase.from('rede_post_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
      ]);
      if (!alive) return;
      setLikeCount(likes.count ?? 0);
      setCommentCount(cmts.count ?? 0);
      if (user) {
        const has = (likes.data ?? []).some((l: { user_id: string }) => l.user_id === user.id);
        setLiked(has);
      }
    })();
    return () => { alive = false; };
  }, [postId, user]);

  async function toggleLike() {
    if (!user) {
      toast.info('Faça login para curtir.');
      return;
    }
    setLikeBusy(true);
    if (liked) {
      const { error } = await supabase
        .from('rede_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (!error) {
        setLiked(false);
        setLikeCount(c => Math.max(0, c - 1));
      } else toast.error(error.message);
    } else {
      const { error } = await supabase
        .from('rede_post_likes')
        .insert({ post_id: postId, user_id: user.id });
      if (!error) {
        setLiked(true);
        setLikeCount(c => c + 1);
      } else toast.error(error.message);
    }
    setLikeBusy(false);
  }

  async function loadComments() {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('rede_post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    else setComments((data ?? []) as CommentRow[]);
    setLoadingComments(false);
  }

  async function openComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) await loadComments();
  }

  async function submitComment() {
    if (!user) { toast.info('Faça login para comentar.'); return; }
    const content = newComment.trim();
    if (!content) return;
    setPosting(true);

    // pull display name from rede_companies (if it's a partner) or profile
    let authorName = user.email?.split('@')[0] ?? 'Usuário';
    let authorAvatar = '';
    const { data: company } = await supabase
      .from('rede_companies')
      .select('name, logo_url')
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (company) {
      authorName = company.name;
      authorAvatar = company.logo_url ?? '';
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.full_name) authorName = profile.full_name;
      if (profile?.avatar_url) authorAvatar = profile.avatar_url;
    }

    const { data, error } = await supabase
      .from('rede_post_comments')
      .insert({
        post_id: postId,
        author_user_id: user.id,
        author_name: authorName,
        author_avatar: authorAvatar,
        content,
      })
      .select()
      .single();

    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setComments(prev => [...prev, data as CommentRow]);
    setCommentCount(c => c + 1);
    setNewComment('');
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('rede_post_comments').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setComments(prev => prev.filter(c => c.id !== id));
    setCommentCount(c => Math.max(0, c - 1));
  }

  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          disabled={likeBusy}
          className={`gap-2 ${liked ? 'text-primary' : ''}`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          <span className="tabular-nums">{likeCount}</span>
          <span className="hidden sm:inline">Curtir</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={openComments} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{commentCount}</span>
          <span className="hidden sm:inline">Comentar</span>
        </Button>
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-3">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map(c => (
                <li key={c.id} className="flex items-start gap-2">
                  {c.author_avatar
                    ? <img src={c.author_avatar} alt="" className="h-8 w-8 rounded-full object-cover bg-muted shrink-0" />
                    : <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {c.author_name.slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{c.author_name}</span>
                        {user?.id === c.author_user_id && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            aria-label="Apagar comentário"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{c.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-3">{formatTime(c.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <div className="flex gap-2">
              <Textarea
                rows={1}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário…"
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
                }}
                className="min-h-[40px] resize-none"
              />
              <Button size="icon" onClick={submitComment} disabled={posting || !newComment.trim()}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link to="/login" className="text-primary underline">Entre</Link> para comentar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
