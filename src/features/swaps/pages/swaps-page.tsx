import { ArrowLeftRight } from 'lucide-react'
import { ComingSoon } from '@/components/shared/coming-soon'
import { images } from '@/lib/media'

export function SwapsPage() {
  return (
    <ComingSoon
      icon={ArrowLeftRight}
      title="Swaps"
      description="Swap workflows will use a modular blockchain adapter with server-side verification of every exchange."
      image={images.cryptoDesk}
      points={['USD ⇄ VFXT conversions', 'Server-verified rates and settlement', 'Every swap written to the ledger']}
    />
  )
}
