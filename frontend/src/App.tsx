import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { PageTransition } from './components/ui/PageTransition';
import { Landing } from './pages/Landing';
import { GoogleGate } from './pages/GoogleGate';
import { InterviewIntro } from './pages/InterviewIntro';
import { UploadRecord } from './pages/UploadRecord';
import { ProcessingStatus } from './pages/ProcessingStatus';
import { Confirmation } from './pages/Confirmation';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { CandidateResults } from './pages/CandidateResults';
import { AdminLogin } from './pages/admin/AdminLogin';
import { CandidateTable } from './pages/admin/CandidateTable';
import { CandidateReport } from './pages/admin/CandidateReport';
import { type ReactNode, useEffect, useState } from 'react';

function CandidateProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user || user.role !== 'candidate') return <GoogleGate />;

  // After successful auth, redirect to dashboard instead of interview/new
  if (location.pathname === '/interview/new') {
    return <Navigate to="/candidate/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { adminSession, loading, setAdminSession } = useAuth();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!adminSession) {
      setChecking(false);
      setValid(false);
      return;
    }

    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      setChecking(false);
      setValid(false);
      return;
    }

    fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'}/admin/jobs`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (res.ok) setValid(true);
        else {
          localStorage.removeItem('admin_token');
          setAdminSession(null);
          setValid(false);
        }
      })
      .catch(() => setValid(true))
      .finally(() => setChecking(false));
  }, [adminSession, loading, setAdminSession]);

  if (loading || (adminSession && checking)) return null;
  if (!adminSession || !valid) return <Navigate to="/admin/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Landing />} />
        <Route
          path="/interview/:jobId"
          element={
            <CandidateProtectedRoute>
              <InterviewIntro />
            </CandidateProtectedRoute>
          }
        />
        <Route
          path="/interview/:jobId/upload"
          element={
            <CandidateProtectedRoute>
              <UploadRecord />
            </CandidateProtectedRoute>
          }
        />
        <Route
          path="/interview/:jobId/status/:interviewId"
          element={
            <CandidateProtectedRoute>
              <ProcessingStatus />
            </CandidateProtectedRoute>
          }
        />
        <Route
          path="/interview/:jobId/confirmation"
          element={
            <CandidateProtectedRoute>
              <Confirmation />
            </CandidateProtectedRoute>
          }
        />
        <Route
          path="/candidate/dashboard"
          element={
            <CandidateProtectedRoute>
              <CandidateDashboard />
            </CandidateProtectedRoute>
          }
        />
        <Route
          path="/candidate/results/:interviewId"
          element={
            <CandidateProtectedRoute>
              <CandidateResults />
            </CandidateProtectedRoute>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRouteGuard>
              <CandidateTable />
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/candidates/:id"
          element={
            <AdminRouteGuard>
              <CandidateReport />
            </AdminRouteGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
