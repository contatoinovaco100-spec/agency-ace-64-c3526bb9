import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck } from "lucide-react";
import logoInova from "@/assets/logo-inova.png";

type AuthorizationDetails = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string } | null;
};

// Typed wrapper over the beta supabase.auth.oauth namespace.
const oauthApi = supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (
      id: string,
    ) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
    approveAuthorization: (
      id: string,
    ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
    denyAuthorization: (
      id: string,
    ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
  };
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Pedido de autorização inválido ou expirado. Tente conectar novamente.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi.oauth.approveAuthorization(authorizationId)
      : await oauthApi.oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou o redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "um aplicativo";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="flex items-center justify-center pb-2">
          <img src={logoInova} alt="INOVA Co." className="h-10" />
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !details ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando pedido de conexão…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <ShieldCheck className="h-12 w-12 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">
                Conectar {clientName} à sua conta
              </h1>
              <p className="text-sm text-muted-foreground">
                Isso permite que {clientName} use a Plataforma Inova como você,
                respeitando suas permissões. Você pode revogar o acesso a qualquer
                momento.
              </p>
              <div className="flex w-full gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Negar
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  {busy ? "Autorizando…" : "Autorizar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
