import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { usePageAccess } from '@/hooks/useUserRole';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { hasPageAccess, isAdmin, loading: accessLoading } = usePageAccess();

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
    // Non-admin users land on /minhas-tarefas, admins on /
    return <Navigate to={isAdmin ? '/' : '/minhas-tarefas'} replace />;
  }

  return <>{children}</>;
}
