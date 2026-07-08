import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { usePageAccess } from '@/hooks/useUserRole';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { hasPageAccess, allowedPaths, isAdmin, isRedeCompanyUser, isAffiliate, loading: accessLoading } = usePageAccess();

  if (loading || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Page-level access check (admin always passes)
  if (!hasPageAccess(location.pathname)) {
    if (isAffiliate) return <Navigate to="/afiliado/leads" replace />;
    if (isRedeCompanyUser) return <Navigate to="/negocios" replace />;
    if (isAdmin) return <Navigate to="/" replace />;

    // Find the first path the user actually has access to (skip affiliate/admin-only)
    const firstAllowed = Array.from(allowedPaths).find(
      p => p !== location.pathname && hasPageAccess(p),
    );
    if (firstAllowed) {
      return <Navigate to={firstAllowed} replace />;
    }

    // If they have literally 0 permissions, or are stuck, show an error state
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-4">Você não tem permissão para acessar nenhuma página no momento.</p>
        <button onClick={() => window.location.href = '/login'} className="text-primary hover:underline">Voltar para o Login</button>
      </div>
    );
  }

  return <>{children}</>;
}
