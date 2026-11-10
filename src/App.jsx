import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import AdminRoute from '@/components/layout/AdminRoute';
const Login = lazy(() => import('@/pages/Login'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Masterlist = lazy(() => import('@/pages/Masterlist'));
const StandardMasterlist = lazy(() => import('@/pages/StandardMasterlist'));
const ExternalCalibrations = lazy(() => import('@/pages/ExternalCalibrations'));
const EquipmentDetail = lazy(() => import('@/pages/EquipmentDetail'));
const CalendarView = lazy(() => import('@/pages/CalendarView'));
const Reports = lazy(() => import('@/pages/Reports'));
const ReportEditor = lazy(() => import('@/pages/ReportEditor'));
const ReportView = lazy(() => import('@/pages/ReportView'));
const Sticker = lazy(() => import('@/pages/Sticker'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Users = lazy(() => import('@/pages/Users'));
const Settings = lazy(() => import('@/pages/Settings'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const BudgetEntry = lazy(() => import('@/pages/BudgetEntry'));
const ProcedureLibrary = lazy(() => import('@/pages/ProcedureLibrary'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required' && window.location.pathname !== '/login') {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigateToLogin(returnTo);
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" /></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/masterlist" element={<Masterlist />} />
          <Route path="/standard-masterlist" element={<StandardMasterlist />} />
          <Route path="/external-calibrations" element={<ExternalCalibrations />} />
          <Route path="/equipment/:id" element={<EquipmentDetail />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/procedures" element={<ProcedureLibrary documentType="procedure" />} />
          <Route path="/process-instructions" element={<ProcedureLibrary documentType="process_instruction" />} />
          <Route path="/reports/new" element={<ReportEditor />} />
          <Route path="/reports/:id/edit" element={<ReportEditor />} />
          <Route path="/reports/:id" element={<ReportView />} />
          <Route path="/sticker/:id" element={<Sticker />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/budget" element={<BudgetEntry />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/assistant" element={<Navigate to="/" replace />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route element={<AdminRoute />}>
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App