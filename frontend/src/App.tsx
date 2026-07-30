import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { Landing } from './pages/Landing';
import { GoogleGate } from './pages/GoogleGate';
import { InterviewIntro } from './pages/InterviewIntro';
import { UploadRecord } from './pages/UploadRecord';
import { ProcessingStatus } from './pages/ProcessingStatus';
import { Confirmation } from './pages/Confirmation';
import { AdminLogin } from './pages/admin/AdminLogin';
import { CandidateTable } from './pages/admin/CandidateTable';
import { CandidateReport } from './pages/admin/CandidateReport';
import { type ReactNode } from 'react';

function CandidateProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'candidate') {
    return <GoogleGate />;
  }
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { adminSession, loading } = useAuth();
  if (loading) return null;
  if (!adminSession) {
    return <Navigate to="/admin/login" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/interview/:jobId" element={<InterviewIntro />} />
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
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <AdminProtectedRoute>
            <CandidateTable />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/candidates/:id"
        element={
          <AdminProtectedRoute>
            <CandidateReport />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
