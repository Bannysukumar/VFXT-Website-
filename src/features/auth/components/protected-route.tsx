import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { useAuth } from '@/features/auth/auth-context'
import { getDb } from '@/lib/firebase'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [memberStatus, setMemberStatus] = useState<'loading' | 'active' | 'pending' | 'blocked'>(
    'loading',
  )

  useEffect(() => {
    if (!user) {
      setMemberStatus('loading')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid))
        if (cancelled) return
        const status = String(snap.data()?.status ?? '')
        if (status === 'pending_registration') setMemberStatus('pending')
        else if (status === 'suspended' || status === 'closed') setMemberStatus('blocked')
        else setMemberStatus('active')
      } catch {
        if (!cancelled) setMemberStatus('active')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || (user && memberStatus === 'loading')) {
    return <LoadingState label="Checking session…" className="min-h-dvh" />
  }
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  if (memberStatus === 'pending') {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname, needsProfile: true }} />
  }
  if (memberStatus === 'blocked') {
    return <Navigate to="/auth/login" replace />
  }
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
