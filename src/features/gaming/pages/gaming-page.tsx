import { Gamepad2 } from 'lucide-react'
import { ComingSoon } from '@/components/shared/coming-soon'
import { images } from '@/lib/media'

export function GamingPage() {
  return (
    <ComingSoon
      icon={Gamepad2}
      title="Gaming"
      description="Feature-flagged gaming surfaces will plug into the same wallet and ledger modules you already use."
      image={images.phoneMarkets}
      points={['Powered by your VFXT wallet', 'Outcomes settled server-side', 'Full history in your ledger']}
    />
  )
}
