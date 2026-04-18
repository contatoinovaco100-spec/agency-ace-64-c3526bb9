// trigger fresh sync 4 - Cache Invalidation Logic
const APP_VERSION = '1.0.4'; // Increment this to force a full cache clear on all devices

import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgencyProvider } from "@/contexts/AgencyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Pages
const Dashboard            = lazy(() => import("./pages/Dashboard"));
const ClientsPage          = lazy(() => import("./pages/ClientsPage"));
const CRMPage              = lazy(() => import("./pages/CRMPage"));
const TasksPage            = lazy(() => import("./pages/TasksPage"));
const TeamPage             = lazy(() => import("./pages/TeamPage"));
const ClientContentPage    = lazy(() => import("./pages/ClientContentPage"));
const LoginPage            = lazy(() => import("./pages/LoginPage"));
const PermissionsPage      = lazy(() => import("./pages/PermissionsPage"));
const ContractsPage        = lazy(() => import("./pages/ContractsPage"));
const ContractSignPage     = lazy(() => import("./pages/ContractSignPage"));
const ReportsPage          = lazy(() => import("./pages/ReportsPage"));
const PortfolioPage        = lazy(() => import("./pages/PortfolioPage"));
const ShootingSchedulePage = lazy(() => import("./pages/ShootingSchedulePage"));
const WhiteboardPage       = lazy(() => import("./pages/WhiteboardPage"));
const ContentPlanningPage  = lazy(() => import("@/pages/ContentPlanningPage"));
const ProspectionPage      = lazy(() => import("@/pages/ProspectionPage"));
const SalesLP              = lazy(() => import("@/pages/SalesLP"));
const SalesEditorPage      = lazy(() => import("@/pages/SalesEditorPage"));
const DiagnosticEditorPage = lazy(() => import("@/pages/DiagnosticEditorPage"));
const DiagnosticLP         = lazy(() => import("@/pages/DiagnosticLP"));
const PublicPortfolioPage  = lazy(() => import("./pages/PublicPortfolioPage"));
const ClientPortalPage     = lazy(() => import("./pages/ClientPortalPage"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const BriefingFormPage     = lazy(() => import("./pages/BriefingFormPage"));
const BriefingsPage        = lazy(() => import("./pages/BriefingsPage"));
const NotificationsPage    = lazy(() => import("./pages/NotificationsPage"));

// New pages
const CalendarPage              = lazy(() => import("./pages/CalendarPage"));
const ChatPage                  = lazy(() => import("./pages/ChatPage"));
const GoalsPage                 = lazy(() => import("./pages/GoalsPage"));
const WeeklyResultsPage         = lazy(() => import("./pages/WeeklyResultsPage"));
const GalleryPage               = lazy(() => import("./pages/GalleryPage"));
const OnboardingPage            = lazy(() => import("./pages/OnboardingPage"));
const CalculatorPage            = lazy(() => import("./pages/CalculatorPage"));
const RoletaPage                = lazy(() => import("./pages/RoletaPage"));
const LinktreePage              = lazy(() => import("./pages/LinktreePage"));
const NovaAssistantPage         = lazy(() => import("./pages/NovaAssistantPage"));
const CollaboratorContractsPage = lazy(() => import("./pages/CollaboratorContractsPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isPublicPage =
    location.pathname.startsWith('/conteudo/') ||
    location.pathname.startsWith('/portal/') ||
    location.pathname.startsWith('/contrato/') ||
    location.pathname.startsWith('/vitrine') ||
    location.pathname.startsWith('/briefing') ||
    location.pathname.startsWith('/proposta') ||
    (location.pathname.startsWith('/diagnostico') && !location.pathname.startsWith('/diagnostico/editar'));

  return (
    <Suspense fallback={<PageLoader />}>
      {isPublicPage ? (
        <Routes>
          <Route path="/conteudo/:taskId"    element={<ClientContentPage />} />
          <Route path="/portal/:clientId"    element={<ClientPortalPage />} />
          <Route path="/contrato/:contractId" element={<ContractSignPage />} />
          <Route path="/vitrine"             element={<PublicPortfolioPage />} />
          <Route path="/briefing"            element={<BriefingFormPage />} />
          <Route path="/proposta"            element={<SalesLP />} />
          <Route path="/proposta/:slug"      element={<SalesLP />} />
          <Route path="/proposta/editar"     element={<SalesEditorPage />} />
          <Route path="/diagnostico"         element={<DiagnosticLP />} />
          <Route path="/diagnostico/:slug"   element={<DiagnosticLP />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/"                    element={<Dashboard />} />
                    <Route path="/clientes"            element={<ClientsPage />} />
                    <Route path="/crm"                 element={<CRMPage />} />
                    <Route path="/tarefas"             element={<TasksPage />} />
                    <Route path="/equipe"              element={<TeamPage />} />
                    <Route path="/planejamento"        element={<ContentPlanningPage />} />
                    <Route path="/permissoes"          element={<PermissionsPage />} />
                    <Route path="/contratos"           element={<ContractsPage />} />
                    <Route path="/contratos-prestadores" element={<CollaboratorContractsPage />} />
                    <Route path="/briefings"           element={<BriefingsPage />} />
                    <Route path="/relatorios"          element={<ReportsPage />} />
                    <Route path="/portfolio"           element={<PortfolioPage />} />
                    <Route path="/gravacoes"           element={<ShootingSchedulePage />} />
                    <Route path="/whiteboard"          element={<WhiteboardPage />} />
                    <Route path="/prospeccao"          element={<ProspectionPage />} />
                    <Route path="/proposta/editar"     element={<SalesEditorPage />} />
                    <Route path="/diagnostico/editar"  element={<DiagnosticEditorPage />} />
                    <Route path="/diagnostico/editar/:editSlug"  element={<DiagnosticEditorPage />} />
                    <Route path="/notificacoes"        element={<NotificationsPage />} />
                    {/* New routes */}
                    <Route path="/calendario"          element={<CalendarPage />} />
                    <Route path="/chat"                element={<ChatPage />} />
                    <Route path="/metas"               element={<GoalsPage />} />
                    <Route path="/resultados-semanais" element={<WeeklyResultsPage />} />
                    <Route path="/galeria"             element={<GalleryPage />} />
                    <Route path="/onboarding"          element={<OnboardingPage />} />
                    <Route path="/calculadora"         element={<CalculatorPage />} />
                    <Route path="/roleta"              element={<RoletaPage />} />
                    <Route path="/linktree"            element={<LinktreePage />} />
                    <Route path="/nova"                element={<NovaAssistantPage />} />
                    <Route path="*"                    element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      )}
    </Suspense>
  );
}

const App = () => {
  // Global Cache Invalidation Logic
  useEffect(() => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
      console.log(`New version detected: ${APP_VERSION}. Clearing cache...`);
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('app_version', APP_VERSION);
      window.location.reload();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <RealtimeNotifications />
          <AgencyProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AgencyProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};


export default App;
