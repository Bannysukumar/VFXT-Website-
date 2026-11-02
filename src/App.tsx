import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { LoadingState } from '@/components/shared/loading-state'

function RouteFallback() {
  return <LoadingState label="Loading page…" className="min-h-dvh" />
}

export default function App() {
  return (
    <AppProviders>
      <Suspense fallback={<RouteFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  )
}
