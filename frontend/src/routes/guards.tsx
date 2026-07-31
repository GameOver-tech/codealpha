import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context'
import type { Role } from '@/types'
import { FullScreenLoader } from '@/components/shared'

interface ProtectedRouteProps {
  roles?: Role[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullScreenLoader />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    // Role mismatch — candidates go to their dashboard, admins to theirs.
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <Outlet />
}

/** Redirect authenticated users away from guest-only pages (login/register). */
export function GuestOnlyRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <FullScreenLoader />
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }
  return <Outlet />
}
