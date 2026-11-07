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

    let unsub: (() => void) | undefined
    let cancelled = false
    let onFocus: (() => void) | undefined
    let onVisibility: (() => void) | undefined

    ;(async () => {
      try {
        await connectEmulatorsIfNeeded()
        if (cancelled) return
        initAppCheck()
        const auth = getFirebaseAuth()
        unsub = onAuthStateChanged(auth, async (next) => {
          setUser(next)
          if (next) {
            try {
              // Pick up emailVerified after the user clicks the verify link.
              await next.reload()
            } catch {
              /* ignore */
            }
            const token = await next.getIdTokenResult(true)
            const role = token.claims.adminRole
            setAdminRole(typeof role === 'string' ? (role as AdminRole) : null)
            setUser(auth.currentUser)
          } else {
            setAdminRole(null)
          }
          setLoading(false)
        })

        onFocus = () => {
          const current = auth.currentUser
          if (!current) return
          void (async () => {
            try {
              await current.reload()
              await current.getIdToken(true)
              if (!cancelled) setUser(auth.currentUser)
            } catch {
              /* ignore */
            }
          })()
        }
        onVisibility = () => {
          if (document.visibilityState === 'visible') onFocus?.()
        }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      unsub?.()
      if (onFocus) window.removeEventListener('focus', onFocus)
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
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
