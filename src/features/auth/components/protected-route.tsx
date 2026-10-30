import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { useAuth } from '@/features/auth/auth-context'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking session…" className="min-h-dvh" />
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function AdminRoute() {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking permissions…" className="min-h-dvh" />
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) return <Navigate to="/app" replace />
  return <Outlet />
}
