import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { signInWithCustomToken } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { Copy, Eye, LogIn, ShieldOff, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonRows } from '@/components/shared/stat-card'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
import {
  adminAdjustWallet,
  adminUpdateUser,
  getAdminUserDetail,
  impersonateUser,
  listUsers,
  setAdminRole,
  type AdminUserSummary,
} from '@/services/admin-service'
import { getFirebaseAuth } from '@/lib/firebase'
import { formatMinor } from '@/lib/money'
import { exportRowsToCsv, exportRowsToExcel } from '@/lib/export-table'
import type { AdminRole } from '@/types/models'

const IMPERSONATOR_KEY = 'vfxt_impersonator'

const WALLET_KINDS = [
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'direct_referral',
  'withdrawal',
  'vfxt',
] as const

const ADMIN_ROLES: (AdminRole | '')[] = [
  '',
  'super_admin',
  'finance_admin',
  'operations_admin',
  'support_admin',
  'readonly_admin',
]

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

function UserDetailDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUserSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''

  const detail = useQuery({
    queryKey: ['admin', 'user', uid],
    queryFn: () => getAdminUserDetail(uid),
    enabled: open && Boolean(uid),
  })

  const profile = detail.data?.profile
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [status, setStatus] = useState('active')
  const [kycStatus, setKycStatus] = useState('none')
  const [adminRole, setAdminRoleLocal] = useState<AdminRole | ''>('')
  const [disabled, setDisabled] = useState(false)
  const [walletKind, setWalletKind] = useState<string>('fund')
  const [adjustDirection, setAdjustDirection] = useState<'credit' | 'debit'>('credit')
  const [amountMinor, setAmountMinor] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  useEffect(() => {
    if (!open || !profile) return
    setDisplayName(String(profile.displayName ?? ''))
    setMobile(String(profile.mobile ?? user?.mobile ?? ''))
    setWalletAddress(String(profile.walletAddress ?? user?.walletAddress ?? ''))
    setStatus(String(profile.status ?? 'active'))
    setKycStatus(String(profile.kycStatus ?? 'none'))
    setAdminRoleLocal((profile.adminRole as AdminRole | null) ?? '')
    setDisabled(Boolean(detail.data?.auth?.disabled))
  }, [open, profile, uid, user, detail.data?.auth?.disabled])

  const saveProfile = useMutation({
    mutationFn: async () => {
      await adminUpdateUser({
        uid,
        displayName: displayName.trim() || undefined,
        mobile: mobile.trim() || undefined,
        walletAddress: walletAddress.trim() ? walletAddress.trim() : null,
        status: status as 'active' | 'suspended' | 'closed',
        kycStatus: kycStatus as 'none' | 'pending' | 'verified' | 'rejected',
        disabled,
      })
      const role = adminRole === '' ? null : adminRole
      if (role !== (profile?.adminRole ?? null)) {
        await setAdminRole(uid, role)
      }
    },
    onSuccess: async () => {
      toast.success('User updated')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'user', uid] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const adjustWallet = useMutation({
    mutationFn: async () => {
      const raw = Number.parseInt(amountMinor, 10)
      if (!Number.isFinite(raw) || raw <= 0) throw new Error('Enter a positive amount in minor units')
      if (adjustReason.trim().length < 3) throw new Error('Reason must be at least 3 characters')
      const signed = adjustDirection === 'credit' ? raw : -raw
      return adminAdjustWallet({
        uid,
        walletKind,
        amountMinor: signed,
        reason: adjustReason.trim(),
      })
    },
    onSuccess: async () => {
      toast.success('Wallet adjusted')
      setAmountMinor('')
      setAdjustReason('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'user', uid] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const loginAs = useMutation({
    mutationFn: async () => {
      const res = await impersonateUser(uid)
      const auth = getFirebaseAuth()
      const adminUid = auth.currentUser?.uid
      if (adminUid) sessionStorage.setItem(IMPERSONATOR_KEY, adminUid)
      await signInWithCustomToken(auth, res.token)
      return res
    },
    onSuccess: (res) => {
      toast.success(`Signed in as ${res.email ?? res.uid}`)
      onOpenChange(false)
      navigate('/app')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const quickSuspend = useMutation({
    mutationFn: async () =>
      adminUpdateUser({ uid, status: 'suspended', disabled: true }),
    onSuccess: async () => {
      toast.success('User suspended')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'user', uid] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const title = user?.displayName || user?.email || 'User'
  const referralCode = String(profile?.referralCode ?? user?.referralCode ?? '')
  const referredByLabel =
    user?.referredByName ||
    user?.referredByCode ||
    (user?.referredBy ? user.referredBy.slice(0, 10) : '—')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {detail.data?.auth?.email ?? user?.email ?? user?.uid}
        </DialogDescription>

        {detail.isLoading ? (
          <SkeletonRows rows={4} />
        ) : detail.isError ? (
          <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />
        ) : profile ? (
          <div className="mt-4 space-y-6">
            <div className="grid gap-3 rounded-xl border border-line bg-canvas p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-muted">Referral code</p>
                <button
                  type="button"
                  className="mt-1 font-mono font-semibold"
                  onClick={() => referralCode && copyText('Referral code', referralCode)}
                >
                  {referralCode || '—'}
                </button>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Referred by</p>
                <p className="mt-1 font-medium">{referredByLabel}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-ink-muted">UID</p>
                <button
                  type="button"
                  className="mt-1 break-all font-mono text-xs"
                  onClick={() => copyText('UID', uid)}
                >
                  {uid}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ud-display">Display name</Label>
                <Input id="ud-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ud-mobile">Mobile</Label>
                <Input id="ud-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ud-wallet">Wallet address</Label>
                <Input
                  id="ud-wallet"
                  className="font-mono text-xs"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ud-status">Status</Label>
                <NativeSelect id="ud-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ud-kyc">KYC status</Label>
                <NativeSelect id="ud-kyc" value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
                  <option value="none">None</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </NativeSelect>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ud-role">Admin role</Label>
                <NativeSelect
                  id="ud-role"
                  value={adminRole}
                  onChange={(e) => setAdminRoleLocal(e.target.value as AdminRole | '')}
                >
                  {ADMIN_ROLES.map((r) => (
                    <option key={r || 'none'} value={r}>
                      {r ? r.replaceAll('_', ' ') : 'No admin role'}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ud-disabled">Auth disabled</Label>
                <NativeSelect
                  id="ud-disabled"
                  value={disabled ? '1' : '0'}
                  onChange={(e) => setDisabled(e.target.value === '1')}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => quickSuspend.mutate()}
                disabled={quickSuspend.isPending}
              >
                <ShieldOff className="size-4" />
                Suspend account
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Wallet balances</p>
              <Table>
                <THead>
                  <tr>
                    <TH>Kind</TH>
                    <TH>Available</TH>
                    <TH>Reserved</TH>
                  </tr>
                </THead>
                <TBody>
                  {(detail.data?.wallets ?? []).map((w) => (
                    <TR key={w.walletId}>
                      <TD className="capitalize">{w.kind.replaceAll('_', ' ')}</TD>
                      <TD className="tabular">
                        {formatMinor(w.availableMinor, {
                          scale: w.currency === 'USD' ? 2 : 0,
                          currency: w.currency === 'USD' ? 'USD' : undefined,
                        })}
                        {w.currency === 'VFXT' ? ' VFXT' : ''}
                      </TD>
                      <TD className="tabular text-ink-muted">
                        {formatMinor(w.reservedMinor, {
                          scale: w.currency === 'USD' ? 2 : 0,
                          currency: w.currency === 'USD' ? 'USD' : undefined,
                        })}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
              <p className="text-sm font-semibold">Credit / debit wallet</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adj-kind">Wallet kind</Label>
                  <NativeSelect id="adj-kind" value={walletKind} onChange={(e) => setWalletKind(e.target.value)}>
                    {WALLET_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adj-dir">Direction</Label>
                  <NativeSelect
                    id="adj-dir"
                    value={adjustDirection}
                    onChange={(e) => setAdjustDirection(e.target.value as 'credit' | 'debit')}
                  >
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adj-amt">Amount (minor units)</Label>
                  <Input
                    id="adj-amt"
                    inputMode="numeric"
                    value={amountMinor}
                    onChange={(e) => setAmountMinor(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="adj-reason">Reason</Label>
                  <Input id="adj-reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" onClick={() => adjustWallet.mutate()} disabled={adjustWallet.isPending}>
                {adjustWallet.isPending ? 'Applying…' : 'Apply adjustment'}
              </Button>
            </div>

            <Button variant="accent" onClick={() => loginAs.mutate()} disabled={loginAs.isPending}>
              <LogIn className="size-4" />
              {loginAs.isPending ? 'Signing in…' : 'Login as user'}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kycFilter, setKycFilter] = useState('')
  const [selected, setSelected] = useState<AdminUserSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const query = useInfiniteQuery({
    queryKey: ['admin', 'users', statusFilter],
    queryFn: ({ pageParam }) =>
      listUsers({
        startAfterUid: pageParam,
        status: statusFilter || undefined,
        limit: 100,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const users = useMemo(() => {
    let all = query.data?.pages.flatMap((p) => p.users) ?? []
    if (kycFilter) all = all.filter((u) => (u.kycStatus ?? 'none') === kycFilter)
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter((u) =>
      [
        u.email,
        u.displayName,
        u.mobile,
        u.referralCode,
        u.referredByName,
        u.referredByCode,
        u.walletAddress,
        u.uid,
      ].some((v) => v?.toLowerCase().includes(term)),
    )
  }, [query.data, search, kycFilter])

  const exportCols = [
    { key: 'displayName', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'referralCode', label: 'Referral code' },
    { key: 'referredByName', label: 'Referred by name' },
    { key: 'referredByCode', label: 'Referred by code' },
    { key: 'walletAddress', label: 'Wallet' },
    { key: 'status', label: 'Status' },
    { key: 'kycStatus', label: 'KYC' },
    { key: 'uid', label: 'UID' },
  ]

  const openUser = (u: AdminUserSummary) => {
    setSelected(u)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Members"
        title="Users"
        description="Search members by name, mobile, or referral. Open a user for advanced controls."
      />

      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, mobile, referral…"
        selects={[
          {
            id: 'user-status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          {
            id: 'user-kyc',
            label: 'KYC',
            value: kycFilter,
            onChange: setKycFilter,
            options: [
              { value: '', label: 'All KYC' },
              { value: 'none', label: 'None' },
              { value: 'pending', label: 'Pending' },
              { value: 'verified', label: 'Verified' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        ]}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        resultCount={users.length}
        exportDisabled={users.length === 0}
        onExportCsv={() =>
          exportRowsToCsv(
            `vfxt-users-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            users as unknown as Array<Record<string, unknown>>,
          )
        }
        onExportExcel={() =>
          exportRowsToExcel(
            `vfxt-users-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            users as unknown as Array<Record<string, unknown>>,
            'Users',
          )
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <SkeletonRows rows={6} />
          ) : query.isError ? (
            <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No users found"
                description={search || statusFilter || kycFilter ? 'Try different filters.' : 'Registered users will appear here.'}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>User</TH>
                    <TH>Mobile</TH>
                    <TH>Referral code</TH>
                    <TH>Referred by</TH>
                    <TH>KYC</TH>
                    <TH className="w-28">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {users.map((u) => {
                    const name = u.displayName || u.email || 'Unnamed user'
                    return (
                      <TR key={u.uid}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-bright to-highlight text-xs font-bold text-brand">
                              {name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{u.displayName || '—'}</p>
                              <p className="truncate text-xs text-ink-muted">{u.email || 'No email'}</p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          {u.mobile ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 text-sm hover:text-brand"
                              onClick={() => copyText('Mobile', u.mobile!)}
                            >
                              {u.mobile}
                              <Copy className="size-3 opacity-40" />
                            </button>
                          ) : (
                            <span className="text-ink-subtle">—</span>
                          )}
                        </TD>
                        <TD>
                          {u.referralCode ? (
                            <button
                              type="button"
                              className="font-mono text-sm font-semibold hover:text-brand"
                              onClick={() => copyText('Referral code', u.referralCode!)}
                            >
                              {u.referralCode}
                            </button>
                          ) : (
                            '—'
                          )}
                        </TD>
                        <TD>
                          {u.referredBy ? (
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {u.referredByName || '—'}
                              </p>
                              <p className="truncate font-mono text-xs text-ink-muted">
                                {u.referredByCode || u.referredBy.slice(0, 10)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-ink-subtle">—</span>
                          )}
                        </TD>
                        <TD>
                          <Badge variant="secondary" className="capitalize">
                            {u.kycStatus?.replaceAll('_', ' ') ?? '—'}
                          </Badge>
                        </TD>
                        <TD>
                          <Button variant="outline" size="sm" onClick={() => openUser(u)}>
                            <Eye className="size-4" />
                            Manage
                          </Button>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading…' : 'Load more users'}
          </Button>
        </div>
      ) : null}

      <UserDetailDialog user={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
