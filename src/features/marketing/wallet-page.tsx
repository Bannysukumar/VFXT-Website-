import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  Camera,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  Network,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  Faq,
  MarketingHero,
  SectionHeading,
  StatsBand,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { walletFaqs } from '@/features/marketing/content'
import { PhonePair, PhoneShowcaseBand } from '@/features/marketing/phone-mockup'
import { TokenFactsStrip } from '@/features/marketing/token-facts'
import { images, videos } from '@/lib/media'
import { VFXT_TOKEN } from '@/lib/vfxt-token'

const capabilities = [
  {
    icon: KeyRound,
    title: 'Create or import',
    body: 'Generate a 12- or 24-word BIP-39 phrase, or import an existing phrase or private key. Phrase backups include a word-order verification step.',
  },
  {
    icon: Wallet,
    title: 'Multi-wallet on one phone',
    body: 'Create or import several wallets, rename them, switch the active one, and reveal a phrase or key only after PIN confirmation.',
  },
  {
    icon: QrCode,
    title: 'Send & receive',
    body: 'Send native coins and tokens with paste, type, or QR scan. Receive with a QR address, copy, or share — always on the active network.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Swap & bridge',
    body: 'Same-chain swaps and cross-chain bridges via LI.FI, with slippage controls, quote review, and no unlimited token approvals.',
  },
  {
    icon: Network,
    title: 'Multi-chain EVM',
    body: 'BNB Smart Chain by default, plus Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, testnets, and custom RPC networks you add yourself.',
  },
  {
    icon: Fingerprint,
    title: 'Device security',
    body: 'App PIN, optional biometrics, auto-lock timers, and screenshot blocking on screens that show secrets. Keys stay encrypted in the on-device vault.',
  },
]

const networks = [
  'BNB Smart Chain',
  'Ethereum',
  'Polygon',
  'Arbitrum One',
  'Optimism',
  'Base',
  'Avalanche C-Chain',
  'BSC & Sepolia testnets',
]

const tabs = [
  { title: 'Home', body: 'Portfolio total, quick actions, recent activity, wallet picker, and pull-to-refresh balances.' },
  { title: 'Mining', body: 'Daily VFXT mining sessions, rewards, claims, and speed boosters — see the Mining page.' },
  { title: 'Trade', body: 'Demo trading preview only. Charts and orders are simulated and do not move wallet funds.' },
  { title: 'Assets', body: 'Searchable token list with totals, custom tokens by contract, and per-token send/receive/swap.' },
  { title: 'Profile', body: 'Wallets, security, currency, notifications, networks, WalletConnect, support, and legal.' },
]

export function WalletPage() {
  return (
    <>
      <MarketingHero
        eyebrow="VFXT Wallet"
        title="Self-custody Android wallet for the VFXT ecosystem"
        description="VFXT Wallet keeps your recovery phrase and keys encrypted on your device. Send, receive, and swap across major EVM networks — with BNB Smart Chain and VFXT as first-class citizens."
        video={videos.cryptoGraphs}
        poster={images.phoneDark}
        aside={<PhonePair front="home" back="assets" />}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="accent" asChild>
            <Link to="/download">
              Download APK
              <Download />
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link to="/mining">Explore mining</Link>
          </Button>
        </div>
      </MarketingHero>

      <StatsBand
        items={[
          { value: 7, label: 'Built-in mainnets' },
          { value: 5, label: 'Bottom-tab workspaces' },
          { value: 25, suffix: '+', label: 'Fiat display currencies' },
          { value: 0, label: 'Keys uploaded to VFXT' },
        ]}
      />

      <PhoneShowcaseBand
        title="Designed for the way you move crypto"
        description="Home, assets, send, receive, and mining — each screen is built for clarity on a real phone, not a desktop squeezed down."
        screens={['home', 'send', 'receive']}
      />

      <section className="container-page py-24 sm:py-32">
        <SectionHeading
          eyebrow="Wallet capabilities"
          title="Everything you expect from a modern EVM wallet"
          description="Built from the same Android codebase members install — create, import, multi-wallet, QR transfers, LI.FI swaps, and on-device security."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              delay={i * 0.05}
              className="rounded-3xl border border-line bg-panel p-7 shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CinematicBand
        title="Your keys never leave the phone"
        description="Secrets live in an Android Keystore–backed vault with backup disabled for app data. Sensitive screens use FLAG_SECURE so screenshots cannot capture your phrase or private key."
        video={videos.workstation}
        poster={images.phoneAndLaptop}
        points={[
          'BIP-39 create & verify flow',
          'Import phrase or private key',
          'PIN + optional biometrics',
          'Auto-lock: immediate to 15 minutes',
        ]}
        cta={{ to: '/download', label: 'Get the official APK' }}
      />

      <StorySplit
        title="Networks and tokens that match how you actually trade"
        description="Default to BNB Smart Chain for USDT and VFXT, then switch to other EVM chains when you need them. Add custom RPC networks and custom token contracts when a listing is missing."
        video={videos.marketUi}
        poster={images.cryptoDesk}
        bullets={[
          'USDT and USDC listed on major chains where available.',
          `${VFXT_TOKEN.symbol} (BEP-20) on BSC — ${VFXT_TOKEN.supplyShort} fixed supply.`,
          'Live USD quotes with 25+ fiat display options.',
          'Activity history for sends, swaps, and approvals with explorer links.',
        ]}
      />

      <section className="container-page py-16 sm:py-20">
        <SectionHeading
          eyebrow="Official token"
          title={`${VFXT_TOKEN.name} contract details`}
          description="Add this verified BEP-20 contract in Assets when you hold VFXT on BNB Smart Chain."
          className="mb-10"
        />
        <Reveal>
          <TokenFactsStrip />
        </Reveal>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="container-page py-24 sm:py-28">
          <SectionHeading
            eyebrow="Supported networks"
            title="Built-in EVM coverage"
            description="Mainnets ship ready. Testnets are included for practice. Custom RPCs are verified against the chain ID before use."
          />
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {networks.map((name) => (
              <Reveal
                key={name}
                className="rounded-full border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink"
              >
                {name}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-24 sm:py-32">
        <SectionHeading
          eyebrow="App layout"
          title="Five tabs. Clear jobs."
          description="The Android shell mirrors how people move value day to day — portfolio, mining, assets, and settings — without mixing platform ledger balances into self-custody keys."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-5">
          {tabs.map(({ title, body }, i) => (
            <Reveal
              key={title}
              delay={i * 0.05}
              className="rounded-3xl border border-line bg-panel p-5 sm:p-6"
            >
              <p className="text-xs font-semibold text-accent">{title}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <StorySplit
        reverse
        title="Platform account vs phone wallet"
        description="The web platform holds server-authoritative Deposit, Daily ROI, Withdrawal, and VFXT ledger balances. The Android wallet is separate self-custody for on-chain assets — including mining rewards claimed to your address."
        video={videos.dataPulse}
        poster={images.analyticsDashboard}
        bullets={[
          'Web: deposits, stakes, referrals, reviewed withdrawals.',
          'Android: keys on device, multi-chain send/receive/swap.',
          'Mining in the wallet signs in with a wallet signature.',
          'Never paste a recovery phrase into a website or chat.',
        ]}
        cta={{ to: '/auth/register', label: 'Open a platform account' }}
      />

      <CinematicBand
        title="WalletConnect-ready when configured"
        description="Manage dApp sessions from Profile when a WalletConnect project ID is enabled for the build. Signing always requires your explicit review — there is no auto-approval."
        video={videos.cityNight}
        poster={images.skyscrapers}
        invertOverlay
        points={[
          'View and disconnect sessions',
          'Reject pending requests',
          'Active sessions listed in Profile',
          'No in-app dApp browser — use WalletConnect',
        ]}
      />

      <section className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.35fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Wallet FAQ"
            title="Questions about VFXT Wallet"
            description="Self-custody means you own the keys. Read these before you install or restore."
          />
          <Reveal delay={0.08}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/download">
                  <Smartphone className="size-4" />
                  Download page
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/support">Support centre</Link>
              </Button>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Faq items={walletFaqs} />
        </Reveal>
      </section>

      <section className="container-page pb-8">
        <Reveal className="grid gap-4 rounded-3xl border border-line bg-panel p-8 sm:grid-cols-3 sm:p-10">
          {[
            { icon: Camera, title: 'QR everywhere', body: 'Scan to send; show a QR to receive.' },
            { icon: Lock, title: 'Secure screens', body: 'Secrets stay off screenshots and recordings.' },
            { icon: ShieldCheck, title: 'Official APK only', body: 'Install from the VFXT download page.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      <CtaBand
        title="Install VFXT Wallet on Android"
        description="Download the official APK, create or import a wallet, and back up your recovery phrase offline before you move real funds."
        video={videos.skylinePan}
        poster={images.phoneMarkets}
      />
    </>
  )
}
