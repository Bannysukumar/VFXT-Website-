import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  connectEmulatorsIfNeeded,
  getFirebaseAuth,
  initAppCheck,
  isFirebaseReady,
} from '@/lib/firebase'
import type { AdminRole } from '@/types/models'

interface AuthContextValue {
  user: User | null
  loading: boolean
  adminRole: AdminRole | null
  isAdmin: boolean
  firebaseConfigured: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readAdminRole(user: User | null): AdminRole | null {
  const claims = (user as User & { accessTokenResult?: { claims?: Record<string, unknown> } }) || null
  void claims
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const firebaseConfigured = isFirebaseReady()

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false)
      return
    }

    try {
      connectEmulatorsIfNeeded()
      initAppCheck()
      const auth = getFirebaseAuth()
      const unsub = onAuthStateChanged(auth, async (next) => {
        setUser(next)
        if (next) {
          const token = await next.getIdTokenResult(true)
          const role = token.claims.adminRole
          setAdminRole(typeof role === 'string' ? (role as AdminRole) : null)
        } else {
          setAdminRole(null)
        }
        setLoading(false)
      })
      return unsub
    } catch {
      setLoading(false)
    }
  }, [firebaseConfigured])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      adminRole: adminRole ?? readAdminRole(user),
      isAdmin: Boolean(adminRole),
      firebaseConfigured,
    }),
    [user, loading, adminRole, firebaseConfigured],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
