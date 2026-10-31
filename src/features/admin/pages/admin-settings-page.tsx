import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Save, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getAdminPlatformSettings, updatePlatformSettings } from '@/services/admin-service'
import { cn } from '@/lib/utils'

type TabId = 'contact' | 'footer' | 'deposit' | 'hotwallet'

type FooterLink = { label: string; href: string }
type FooterColumn = { title: string; links: FooterLink[] }

const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Token', href: '/token' },
      { label: 'Security', href: '/security' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Risk', href: '/legal/risk' },
    ],
  },
]

const tabs: { id: TabId; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'footer', label: 'Footer' },
  { id: 'deposit', label: 'Deposit / token' },
  { id: 'hotwallet', label: 'Hot wallet pool' },
]

export function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabId>('contact')

  const settings = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
  })

  const [contact, setContact] = useState<Record<string, string>>({})
  const [footerTagline, setFooterTagline] = useState('')
  const [footerCopyright, setFooterCopyright] = useState('')
  const [footerColumns, setFooterColumns] = useState<FooterColumn[]>(DEFAULT_FOOTER_COLUMNS)
  const [minDepositUsdCents, setMinDepositUsdCents] = useState('')
  const [tokensPerUsd, setTokensPerUsd] = useState('')
  const [tokenPriceUsd, setTokenPriceUsd] = useState('')
  const [multiWalletEnabled, setMultiWalletEnabled] = useState(false)

  useEffect(() => {
    const s = settings.data
    if (!s) return
    const c = s.contact as Record<string, string> | undefined
    if (c) {
      setContact({
        companyName: c.companyName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        addressLine1: c.addressLine1 ?? '',
        addressLine2: c.addressLine2 ?? '',
        city: c.city ?? '',
        region: c.region ?? '',
        postalCode: c.postalCode ?? '',
        country: c.country ?? '',
        supportHours: c.supportHours ?? '',
      })
    }
    const f = s.footer as { tagline?: string; copyright?: string; columns?: FooterColumn[] } | undefined
    if (f) {
      setFooterTagline(f.tagline ?? '')
      setFooterCopyright(f.copyright ?? '')
      const cols = Array.isArray(f.columns) ? f.columns : []
      setFooterColumns(
        cols.length
          ? cols.map((c) => ({
              title: String(c.title ?? ''),
              links: Array.isArray(c.links)
                ? c.links.map((l) => ({
                    label: String(l?.label ?? ''),
                    href: String(l?.href ?? ''),
                  }))
                : [],
            }))
          : DEFAULT_FOOTER_COLUMNS,
      )
    }
    const d = s.deposit as Record<string, unknown> | undefined
    if (d) {
      setMinDepositUsdCents(String(d.minDepositUsdCents ?? ''))
    }
    const t = s.token as Record<string, unknown> | undefined
    if (t) {
      const per = Number(t.tokensPerUsd ?? 10_000)
      setTokensPerUsd(String(per))
      setTokenPriceUsd(per > 0 ? String(1 / per) : '')
    }
    const h = s.hotWalletPool as { multiWalletEnabled?: boolean } | undefined
    if (h) setMultiWalletEnabled(Boolean(h.multiWalletEnabled))
  }, [settings.data])

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: async () => {
      toast.success('Settings saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['platform', 'public'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveContact = () => save.mutate({ contact })
  const saveFooter = () => {
    const columns = footerColumns
      .map((col) => ({
        title: col.title.trim(),
        links: col.links
          .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
          .filter((l) => l.label && l.href),
      }))
      .filter((col) => col.title)
    if (!columns.length) {
      toast.error('Add at least one footer column with a title')
      return
    }
    save.mutate({
      footer: { tagline: footerTagline, copyright: footerCopyright, columns },
    })
  }

  const updateColumn = (index: number, patch: Partial<FooterColumn>) => {
    setFooterColumns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }
  const updateLink = (colIndex: number, linkIndex: number, patch: Partial<FooterLink>) => {
    setFooterColumns((prev) =>
      prev.map((c, i) =>
        i === colIndex
          ? {
              ...c,
              links: c.links.map((l, j) => (j === linkIndex ? { ...l, ...patch } : l)),
            }
          : c,
      ),
    )
  }
  const saveDepositToken = () => {
    let per = Number.parseInt(tokensPerUsd, 10)
    const price = Number.parseFloat(tokenPriceUsd)
    if (Number.isFinite(price) && price > 0) {
      per = Math.max(1, Math.round(1 / price))
    }
    if (!Number.isFinite(per) || per <= 0) {
      toast.error('Set a valid token price or VFXT per $1')
      return
    }
    save.mutate({
      deposit: {
        minDepositUsdCents: Number.parseInt(minDepositUsdCents, 10),
      },
      token: {
        tokensPerUsd: per,
      },
    })
  }
  const saveHotWallet = () => save.mutate({ hotWalletPool: { multiWalletEnabled } })

  if (settings.isLoading) return <LoadingState />
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Platform settings"
        description="Contact details, footer content, deposit / token price, and hot wallet pool. Plan and Withdraw are separate menu pages."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.id)}
            className={cn(tab === t.id && 'shadow-sm')}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'contact' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-sans text-lg">
              <Settings2 className="size-5" />
              Contact details
            </CardTitle>
            <CardDescription>Shown on the public contact page when loaded from settings.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['companyName', 'Company name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['addressLine1', 'Address line 1'],
                ['addressLine2', 'Address line 2'],
                ['city', 'City'],
                ['region', 'Region'],
                ['postalCode', 'Postal code'],
                ['country', 'Country'],
                ['supportHours', 'Support hours'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === 'supportHours' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`c-${key}`}>{label}</Label>
                <Input
                  id={`c-${key}`}
                  className="mt-2"
                  value={contact[key] ?? ''}
                  onChange={(e) => setContact((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button onClick={saveContact} disabled={save.isPending}>
                <Save className="size-4" />
                Save contact
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'footer' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Footer</CardTitle>
            <CardDescription>
              Edit site footer text and link columns. Each column is a heading with links under it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="f-tag">Tagline</Label>
                <Input id="f-tag" value={footerTagline} onChange={(e) => setFooterTagline(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-copy">Copyright</Label>
                <Input id="f-copy" value={footerCopyright} onChange={(e) => setFooterCopyright(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Link columns</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFooterColumns((prev) => [...prev, { title: 'New column', links: [{ label: '', href: '/' }] }])
                  }
                >
                  <Plus className="size-4" />
                  Add column
                </Button>
              </div>

              {footerColumns.map((col, colIndex) => (
                <div key={colIndex} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[12rem] flex-1 space-y-2">
                      <Label>Column title</Label>
                      <Input
                        value={col.title}
                        onChange={(e) => updateColumn(colIndex, { title: e.target.value })}
                        placeholder="e.g. Product"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-danger"
                      onClick={() => setFooterColumns((prev) => prev.filter((_, i) => i !== colIndex))}
                    >
                      <Trash2 className="size-4" />
                      Remove column
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Links</p>
                    {col.links.map((link, linkIndex) => (
                      <div key={linkIndex} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={link.label}
                          onChange={(e) => updateLink(colIndex, linkIndex, { label: e.target.value })}
                          placeholder="Label (e.g. Token)"
                        />
                        <Input
                          value={link.href}
                          onChange={(e) => updateLink(colIndex, linkIndex, { href: e.target.value })}
                          placeholder="Path (e.g. /token)"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateColumn(colIndex, {
                              links: col.links.filter((_, j) => j !== linkIndex),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateColumn(colIndex, {
                          links: [...col.links, { label: '', href: '' }],
                        })
                      }
                    >
                      <Plus className="size-4" />
                      Add link
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={saveFooter} disabled={save.isPending}>
              <Save className="size-4" />
              Save footer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'deposit' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Deposit &amp; token price</CardTitle>
            <CardDescription>
              Successful USDT deposits credit Fund Wallet (USD for staking) and VFXT tokens at your
              rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid max-w-md gap-4">
            <div className="space-y-2">
              <Label>Min deposit (USD cents)</Label>
              <Input
                value={minDepositUsdCents}
                onChange={(e) => setMinDepositUsdCents(e.target.value)}
                placeholder="1000 = $10"
              />
              <p className="text-xs text-ink-muted">
                ${(Number(minDepositUsdCents || 0) / 100).toFixed(2)} minimum
              </p>
            </div>
            <div className="space-y-2">
              <Label>Token price (USD per 1 VFXT)</Label>
              <Input
                value={tokenPriceUsd}
                onChange={(e) => {
                  setTokenPriceUsd(e.target.value)
                  const p = Number.parseFloat(e.target.value)
                  if (Number.isFinite(p) && p > 0) {
                    setTokensPerUsd(String(Math.max(1, Math.round(1 / p))))
                  }
                }}
                placeholder="0.0001"
              />
            </div>
            <div className="space-y-2">
              <Label>VFXT tokens per $1 USDT</Label>
              <Input
                value={tokensPerUsd}
                onChange={(e) => {
                  setTokensPerUsd(e.target.value)
                  const n = Number.parseInt(e.target.value, 10)
                  if (Number.isFinite(n) && n > 0) setTokenPriceUsd(String(1 / n))
                }}
                placeholder="10000"
              />
              <p className="text-xs text-ink-muted">
                Example: $100 deposit →{' '}
                {Number.isFinite(Number(tokensPerUsd))
                  ? (100 * Number(tokensPerUsd)).toLocaleString()
                  : '—'}{' '}
                VFXT
              </p>
            </div>
            <Button onClick={saveDepositToken} disabled={save.isPending}>
              <Save className="size-4" />
              Save deposit / token settings
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'hotwallet' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Hot wallet pool</CardTitle>
            <CardDescription>When enabled, deposits and withdrawals rotate across pool wallets.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-w-md gap-4">
            <div className="space-y-2">
              <Label>Multi-wallet enabled</Label>
              <NativeSelect
                value={multiWalletEnabled ? '1' : '0'}
                onChange={(e) => setMultiWalletEnabled(e.target.value === '1')}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelect>
            </div>
            <Button onClick={saveHotWallet} disabled={save.isPending}>
              <Save className="size-4" />
              Save pool settings
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
