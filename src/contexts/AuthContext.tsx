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

type AuthErrorWithStatus = Error & { status?: number; code?: string };

const isConnectionError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('timeout') ||
    message.includes('timed out');
};

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function signInThroughAuthEndpoint(email: string, password: string): Promise<{ error: Error | null }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) {
    return { error: new TypeError('Authentication service configuration unavailable') };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as {
      access_token?: string;
      refresh_token?: string;
      message?: string;
      error_description?: string;
      error_code?: string;
      code?: string;
    };

    if (!response.ok) {
      const authError = new Error(
        payload.message || payload.error_description || 'Authentication failed',
      ) as AuthErrorWithStatus;
      authError.status = response.status;
      authError.code = payload.error_code || payload.code;
      return { error: authError };
    }

    if (!payload.access_token || !payload.refresh_token) {
      return { error: new Error('Authentication response did not include a session') };
    }

    const { error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });
    return { error: error as Error | null };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { error: new TypeError('Authentication request timed out') };
    }
    return { error: error instanceof Error ? error : new Error('Authentication request failed') };
  } finally {
    window.clearTimeout(timeout);
  }
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
    // A chamada padrão pode falhar em alguns navegadores por bloqueios locais de
    // armazenamento/rede. Nessa situação, repetimos uma vez e usamos o endpoint
    // oficial diretamente antes de concluir que há um problema de conexão.
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return { error: null };
        const status = (error as AuthErrorWithStatus).status;
        const retryable = isConnectionError(error) || (typeof status === 'number' && status >= 500);
        if (!retryable) return { error: error as Error };
        lastError = error as Error;
      } catch (e) {
        if (!isConnectionError(e)) {
          return { error: e instanceof Error ? e : new Error('Authentication failed') };
        }
        lastError = e instanceof Error ? e : new Error('Authentication request failed');
      }
      if (attempt === 0) await wait(700);
    }

    const fallback = await signInThroughAuthEndpoint(email, password);
    return fallback.error ? { error: fallback.error ?? lastError } : { error: null };
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
