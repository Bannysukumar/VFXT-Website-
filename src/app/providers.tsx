import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'

function AppErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown
  resetErrorBoundary: () => void
}) {
  const message = error instanceof Error ? error.message : 'Unexpected rendering error'
  return (
    <div className="container-page flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl">Something broke</h1>
      <p className="max-w-md text-sm text-ink-muted">{message}</p>
      <Button onClick={resetErrorBoundary}>Reload UI</Button>
    </div>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
