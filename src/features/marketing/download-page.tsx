import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ShieldAlert,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Reveal } from '@/components/motion/reveal'
import { MarketingHero, SectionHeading } from '@/features/marketing/marketing-hero'
import { LoadingState } from '@/components/shared/loading-state'
import { images, videos } from '@/lib/media'
import { formatApkSize, getWalletApkRelease } from '@/services/wallet-apk-service'

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
        description="Install the official VFXT Wallet APK for BNB Smart Chain and other EVM networks. Self-custody keys stay on your device."
        video={videos.cryptoGraphs}
        poster={images.phoneMarkets}
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
            <Link to="/security">Security model</Link>
          </Button>
        </div>
      </MarketingHero>

      <section className="container-page py-16 sm:py-24">
        <Reveal>
          <SectionHeading
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
      </section>
    </>
  )
}
