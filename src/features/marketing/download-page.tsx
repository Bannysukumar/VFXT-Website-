import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  MarketingHero,
  SectionHeading,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { LoadingState } from '@/components/shared/loading-state'
import { PhonePair, PhoneShowcaseBand, WalletPhone } from '@/features/marketing/phone-mockup'
import { images, videos } from '@/lib/media'
import { formatApkSize, getWalletApkRelease } from '@/services/wallet-apk-service'

const installSteps = [
  {
    icon: Download,
    title: 'Download from this page only',
    body: 'Use the official APK published here. Builds from unknown sites may be unsafe.',
  },
  {
    icon: Smartphone,
    title: 'Allow install once',
    body: 'Enable install from unknown sources for this file, install, then turn the setting off again.',
  },
  {
    icon: KeyRound,
    title: 'Create and back up',
    body: 'Create a new wallet in-app and write your recovery phrase offline. Never share it.',
  },
  {
    icon: ShieldCheck,
    title: 'Test with a tiny send',
    body: 'Send a small amount first on BNB Smart Chain before larger transfers.',
  },
]

export function DownloadPage() {
  const release = useQuery({
    queryKey: ['public', 'wallet-apk'],
    queryFn: getWalletApkRelease,
  })

  const available = release.data?.available === true ? release.data : null

  return (
    <>
      <MarketingHero
        eyebrow="VFXT Wallet"
        title="Download the Android wallet"
        description="Install the official VFXT Wallet APK for BNB Smart Chain and other EVM networks. Self-custody keys stay on your device — VFXT never stores your recovery phrase."
        video={videos.cryptoGraphs}
        poster={images.phoneInHand}
        aside={<PhonePair front="home" back="security" />}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          {available ? (
            <Button size="lg" variant="accent" asChild>
              <a href={available.downloadUrl} download={available.fileName}>
                Download v{available.versionName}
                <Download />
              </a>
            </Button>
          ) : (
            <Button size="lg" variant="accent" asChild>
              <Link to="/auth/register">
                Create account
                <ArrowRight />
              </Link>
            </Button>
          )}
          <Button size="lg" variant="glass" asChild>
            <Link to="/wallet">See features</Link>
          </Button>
        </div>
      </MarketingHero>

      <PhoneShowcaseBand
        title="What you install"
        description="Portfolio, mining, send, and security — the same product surfaces that ship in the Android build."
        screens={['home', 'mining', 'security']}
      />

      <section className="container-page py-16 sm:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_0.85fr]">
          <div>
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Android APK"
            title="Official build"
            description="Use only the file published here. Sideloaded copies from unknown sites may be unsafe."
          />
        </Reveal>

        <div className="mt-10">
          {release.isLoading ? <LoadingState /> : null}
          {release.isError ? (
            <Card>
              <CardContent className="flex items-start gap-3 p-6 text-sm text-ink-muted">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                Could not load the download right now. Please try again shortly.
              </CardContent>
            </Card>
          ) : null}

          {!release.isLoading && !release.isError && !available ? (
            <Card>
              <CardContent className="space-y-3 p-8 text-center">
                <Smartphone className="mx-auto h-10 w-10 text-ink-muted" />
                <h3 className="text-lg font-semibold">APK coming soon</h3>
                <p className="text-sm text-ink-muted">
                  An admin has not published a wallet build yet. Check back soon, or contact support.
                </p>
                <Button asChild variant="outline">
                  <Link to="/contact">Contact support</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {available ? (
            <Card className="overflow-hidden">
              <CardContent className="grid gap-8 p-6 sm:grid-cols-[1.2fr_0.8fr] sm:p-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Latest published build
                  </div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">
                    VFXT Wallet {available.versionName}
                  </h3>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-ink-muted">Version code</dt>
                      <dd className="font-medium">{available.versionCode}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Size</dt>
                      <dd className="font-medium">{formatApkSize(available.sizeBytes)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-ink-muted">File</dt>
                      <dd className="break-all font-medium">{available.fileName}</dd>
                    </div>
                    {available.publishedAt ? (
                      <div className="sm:col-span-2">
                        <dt className="text-ink-muted">Published</dt>
                        <dd className="font-medium">
                          {new Date(available.publishedAt).toLocaleString()}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {available.notes ? (
                    <div className="rounded-xl border border-line bg-panel-elevated/40 p-4 text-sm whitespace-pre-wrap">
                      {available.notes}
                    </div>
                  ) : null}
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <a href={available.downloadUrl} download={available.fileName}>
                      <Download className="mr-2 h-4 w-4" />
                      Download APK
                    </a>
                  </Button>
                </div>
                <div className="space-y-3 rounded-2xl border border-line bg-panel p-5 text-sm text-ink-muted">
                  <p className="font-medium text-ink">Before you install</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Enable install from unknown sources only for this file, then turn it off again.</li>
                    <li>Create a new wallet in-app and back up your recovery phrase offline.</li>
                    <li>Never import public test phrases (for example “abandon … about”).</li>
                    <li>Send a tiny test amount first before larger deposits.</li>
                  </ul>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/security">
                      Read security model
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
          </div>
          <Reveal className="relative mx-auto hidden justify-center lg:flex">
            <WalletPhone screen="home" float />
            <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-accent/10 blur-3xl" />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="container-page py-20 sm:py-28">
          <SectionHeading
            eyebrow="Install guide"
            title="Four steps to a safer first launch"
            description="Self-custody means you own the keys — and the responsibility. Follow these steps every time you install or restore."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {installSteps.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.06}
                className="rounded-3xl border border-line bg-canvas p-6"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                <p className="mt-5 text-xs font-semibold text-accent">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySplit
        title="Platform account and self-custody wallet"
        description="Your VFXT web account holds ledger balances (Deposit, Daily ROI, Withdrawal, VFXT). The Android wallet is separate self-custody for on-chain assets on EVM networks."
        video={videos.marketUi}
        poster={images.phoneAndLaptop}
        bullets={[
          'Web app: server-authoritative balances and reviewed payouts.',
          'Android wallet: keys generated and stored on your device.',
          'Use BNB Smart Chain for USDT and VFXT token transfers.',
          'Never paste your seed into a website or chat.',
        ]}
        cta={{ to: '/auth/register', label: 'Open a web account' }}
      />

      <CinematicBand
        title="Keys stay on your phone"
        description="VFXT Wallet is built for members who want direct EVM access alongside the platform ledger — without handing custody of on-device keys to anyone else."
        video={videos.skylinePan}
        poster={images.cryptoDesk}
        points={[
          'BNB Smart Chain ready',
          'Multi-network EVM support',
          'Offline recovery phrase backup',
          'Official APK channel only',
        ]}
        cta={
          available
            ? undefined
            : { to: '/contact', label: 'Ask when the APK ships' }
        }
      />

      <section className="container-page py-16">
        <Reveal className="flex flex-col items-start gap-4 rounded-3xl border border-line bg-panel p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Wallet className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Already have a VFXT account?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Sign in on the web for deposits, stakes, and withdrawals — keep the Android wallet for self-custody sends.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/auth/login">
              Sign in
              <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </section>

      <section className="border-t border-line bg-panel">
        <div className="container-page py-20 sm:py-28">
          <SectionHeading
            eyebrow="Learn before you install"
            title="Read the feature guides"
            description="The APK is only half the story. These pages explain what ships in VFXT Wallet today — taken from the Android product itself."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="rounded-3xl border border-line bg-canvas p-8">
              <h3 className="text-xl font-semibold">Wallet features</h3>
              <p className="mt-3 text-sm text-ink-muted">
                Create/import, multi-wallet, QR send and receive, LI.FI swap and bridge, networks, tokens,
                PIN, biometrics, and WalletConnect sessions.
              </p>
              <Button asChild className="mt-6">
                <Link to="/wallet">
                  Open wallet guide
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
            <Reveal delay={0.06} className="rounded-3xl border border-line bg-canvas p-8">
              <h3 className="text-xl font-semibold">Mining guide</h3>
              <p className="mt-3 text-sm text-ink-muted">
                Daily sessions, claims, USDT boosters, server rules, and how mining differs from web daily
                income stakes.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/mining">
                  Open mining guide
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand
        title="Start with the platform, add the wallet when ready"
        description="Create your VFXT account in minutes. Download the Android wallet from this page whenever a build is published."
        video={videos.floatingIndicators}
        poster={images.tradingDesk}
      />
    </>
  )
}
