import { useRef } from 'react'

/** Stable idempotency key for a form session; regenerate after successful submit. */
export function useIdempotencyKey() {
  const keyRef = useRef(crypto.randomUUID())

  return {
    key: keyRef.current,
    refresh: () => {
      keyRef.current = crypto.randomUUID()
      return keyRef.current
    },
  }
}
