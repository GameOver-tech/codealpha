import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute, GuestOnlyRoute } from './guards'
import { FullScreenLoader } from '@/components/shared'
import { NotFoundPage, ForbiddenPage, ServerErrorPage } from '@/pages/errors'
import { CandidateLayout } from '@/layouts/CandidateLayout'
import { AdminLayout } from '@/layouts/AdminLayout'

// Lazy-loaded pages for code splitting.
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const DashboardOverview = lazy(() => import('@/pages/candidate/DashboardOverview').then((m) => ({ default: m.DashboardOverview })))
const CandidateProfile = lazy(() => import('@/pages/candidate/CandidateProfile').then((m) => ({ default: m.CandidateProfile })))
const CandidateSettings = lazy(() => import('@/pages/candidate/CandidateSettings').then((m) => ({ default: m.CandidateSettings })))
const CandidateResults = lazy(() => import('@/pages/candidate/CandidateResults').then((m) => ({ default: m.CandidateResults })))
const CandidateProcessing = lazy(() => import('@/pages/candidate/CandidateProcessing').then((m) => ({ default: m.CandidateProcessing })))
const CandidateUploadPage = lazy(() => import('@/pages/candidate/CandidateUpload').then((m) => ({ default: m.CandidateUploadPage })))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminCandidates = lazy(() => import('@/pages/admin/AdminCandidates').then((m) => ({ default: m.AdminCandidates })))
const AdminCandidateDetail = lazy(() => import('@/pages/admin/AdminCandidateDetail').then((m) => ({ default: m.AdminCandidateDetail })))
const AdminUpload = lazy(() => import('@/pages/admin/AdminUpload').then((m) => ({ default: m.AdminUpload })))
const AdminProcessing = lazy(() => import('@/pages/admin/AdminProcessing').then((m) => ({ default: m.AdminProcessing })))
const AdminReports = lazy(() => import('@/pages/admin/AdminReports').then((m) => ({ default: m.AdminReports })))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <LandingPage />
            </Suspense>
          }
        />

        {/* Guest-only auth */}
        <Route element={<GuestOnlyRoute />}>
          <Route
            path="/login"
            element={
              <Suspense fallback={<FullScreenLoader />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route
            path="/register"
            element={
              <Suspense fallback={<FullScreenLoader />}>
                <RegisterPage />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<FullScreenLoader />}>
                <ForgotPasswordPage />
              </Suspense>
            }
          />
        </Route>

        {/* Candidate routes */}
        <Route element={<ProtectedRoute roles={['candidate']} />}>
          <Route element={<CandidateLayout />}>
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <DashboardOverview />
                </Suspense>
              }
            />
            <Route
              path="/dashboard/profile"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <CandidateProfile />
                </Suspense>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <CandidateSettings />
                </Suspense>
              }
            />
            <Route
              path="/dashboard/results"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <CandidateResults />
                </Suspense>
              }
            />
            <Route
              path="/dashboard/processing"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <CandidateProcessing />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/upload"
            element={
              <Suspense fallback={<FullScreenLoader />}>
                <CandidateUploadPage />
              </Suspense>
            }
          />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="/admin/candidates"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminCandidates />
                </Suspense>
              }
            />
            <Route
              path="/admin/candidates/:interviewId"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminCandidateDetail />
                </Suspense>
              }
            />
            <Route
              path="/admin/upload"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminUpload />
                </Suspense>
              }
            />
            <Route
              path="/admin/processing/:interviewId"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminProcessing />
                </Suspense>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminReports />
                </Suspense>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <AdminSettings />
                </Suspense>
              }
            />
          </Route>
        </Route>

        {/* Errors */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
