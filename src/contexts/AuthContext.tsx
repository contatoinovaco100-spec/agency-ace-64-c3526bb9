import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // O serviço de contas pode reiniciar/oscilar por alguns segundos.
    // Nesses casos o supabase-js lança "Failed to fetch": tentamos novamente antes de falhar.
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return { error: null };
        const msg = error.message.toLowerCase();
        const retryable =
          msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') ||
          (typeof (error as { status?: number }).status === 'number' && (error as { status?: number }).status! >= 500);
        if (!retryable) return { error: error as Error };
        lastError = error as Error;
      } catch (e) {
        lastError = e as Error;
      }
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
    return { error: lastError };
  };


  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('role:') || k.startsWith('rede:')) sessionStorage.removeItem(k);
      });
    } catch { /* ignore */ }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
