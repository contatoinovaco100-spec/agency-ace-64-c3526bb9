import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STORAGE_KEY = 'google_calendar_tokens';
const REDIRECT_URI = `${window.location.origin}/calendario`;

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

export function useGoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const getTokens = (): GoogleTokens | null => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  };

  const saveTokens = (tokens: GoogleTokens) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    setConnected(true);
  };

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConnected(false);
    setGoogleEvents([]);
  };

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = getTokens();
    if (!tokens) return null;

    if (Date.now() < tokens.expires_at - 60000) {
      return tokens.access_token;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'refresh-token', refreshToken: tokens.refresh_token },
      });
      if (error) throw error;
      const newTokens: GoogleTokens = {
        access_token: data.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };
      saveTokens(newTokens);
      return newTokens.access_token;
    } catch {
      disconnect();
      toast.error('Sessão Google expirada. Conecte novamente.');
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'get-auth-url', redirectUri: REDIRECT_URI },
      });
      if (error) throw error;
      window.location.href = data.authUrl;
    } catch (e) {
      toast.error('Erro ao iniciar conexão com Google');
      console.error(e);
    }
  }, []);

  const fetchEvents = useCallback(async (year: number, month: number) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      console.warn('[GoogleCalendar] Sem token válido, abortando fetchEvents');
      return;
    }

    try {
      setLoading(true);
      const timeMin = new Date(year, month, 1).toISOString();
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      console.log('[GoogleCalendar] Buscando eventos', { timeMin, timeMax });
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'list-events', accessToken, timeMin, timeMax },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      console.log('[GoogleCalendar] Eventos recebidos:', data?.items?.length ?? 0);
      setGoogleEvents(data.items || []);
    } catch (e: any) {
      console.error('Erro ao buscar eventos Google:', e);
      const msg = e?.message || 'Erro desconhecido';
      // Se for erro 401/invalid_grant, força reconexão
      if (msg.includes('401') || msg.toLowerCase().includes('invalid')) {
        toast.error('Sessão Google expirada. Conecte novamente.');
        disconnect();
      } else {
        toast.error(`Erro ao buscar eventos do Google: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [getValidAccessToken]);

  const handleOAuthCallback = useCallback(async (code: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'exchange-code', code, redirectUri: REDIRECT_URI },
      });
      if (error) throw error;
      const tokens: GoogleTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };
      saveTokens(tokens);
      toast.success('Google Calendar conectado!');
      // Clean URL
      window.history.replaceState({}, '', '/calendario');
      
      // Força a atualização imediatamente após salvar os tokens
      const now = new Date();
      fetchEvents(now.getFullYear(), now.getMonth());
    } catch (e) {
      toast.error('Erro ao conectar Google Calendar');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents]);


  const createEvent = useCallback(async (summary: string, date: string) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    try {
      const event = {
        summary,
        start: { date },
        end: { date },
      };
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'create-event', accessToken, event },
      });
      if (error) throw error;
      toast.success('Evento criado no Google Calendar!');
      return data;
    } catch (e) {
      toast.error('Erro ao criar evento no Google');
      console.error(e);
    }
  }, [getValidAccessToken]);

  const deleteGoogleEvent = useCallback(async (eventId: string) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    try {
      const { error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'delete-event', accessToken, eventId },
      });
      if (error) throw error;
      toast.success('Evento removido do Google Calendar');
    } catch (e) {
      toast.error('Erro ao remover evento do Google');
      console.error(e);
    }
  }, [getValidAccessToken]);

  // Check connection on mount and handle OAuth callback
  const isExchanging = useRef(false);
  useEffect(() => {
    const tokens = getTokens();
    if (tokens) setConnected(true);

    // 1) Code capturado precocemente em App.tsx (sessionStorage), antes do redirect de login
    const pendingCode = sessionStorage.getItem('pending_google_calendar_code');
    if (pendingCode && !isExchanging.current) {
      isExchanging.current = true;
      sessionStorage.removeItem('pending_google_calendar_code');
      handleOAuthCallback(pendingCode);
      return;
    }

    // 2) Fallback: caso o code ainda esteja na URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !isExchanging.current) {
      isExchanging.current = true;
      handleOAuthCallback(code);
    }
  }, [handleOAuthCallback]);

  return {
    connected,
    loading,
    googleEvents,
    connect,
    disconnect,
    fetchEvents,
    createEvent,
    deleteGoogleEvent,
  };
}
