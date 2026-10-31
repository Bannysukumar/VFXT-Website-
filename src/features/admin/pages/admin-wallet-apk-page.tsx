import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Smartphone, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  formatApkSize,
  getWalletApkRelease,
  publishWalletApk,
  unpublishWalletApk,
  uploadWalletApk,
} from '@/services/wallet-apk-service'

const MAX_BYTES = 80 * 1024 * 1024

export function AdminWalletApkPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [versionName, setVersionName] = useState('1.0.0')
  const [versionCode, setVersionCode] = useState('1')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const release = useQuery({
    queryKey: ['admin', 'wallet-apk'],
    queryFn: getWalletApkRelease,
  })

  const publish = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose an .apk file first.')
      if (!file.name.toLowerCase().endsWith('.apk')) throw new Error('File must be an .apk')
      if (file.size <= 0 || file.size > MAX_BYTES) {
        throw new Error(`APK must be between 1 byte and ${formatApkSize(MAX_BYTES)}.`)
      }
      const code = Number(versionCode)
      if (!Number.isInteger(code) || code < 1) throw new Error('Version code must be a positive integer.')
      const name = versionName.trim()
      if (!name) throw new Error('Enter a version name (e.g. 1.0.0).')

      setProgress(0)
      const uploaded = await uploadWalletApk(file, name, setProgress)
      return publishWalletApk({
        versionName: name,
        versionCode: code,
        fileName: uploaded.fileName,
        downloadUrl: uploaded.downloadUrl,
        storagePath: uploaded.storagePath,
        sizeBytes: file.size,
        notes: notes.trim(),
      })
    },
    onSuccess: async (res) => {
      toast.success(`Published VFXT Wallet ${res.versionName}`)
      setFile(null)
      setNotes('')
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['admin', 'wallet-apk'] })
      await queryClient.invalidateQueries({ queryKey: ['public', 'wallet-apk'] })
    },
    onError: (e: Error) => {
      setProgress(null)
      toast.error(e.message || 'Upload failed')
    },
  })

  const unpublish = useMutation({
    mutationFn: unpublishWalletApk,
    onSuccess: async () => {
      toast.success('APK unpublished from the download page')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'wallet-apk'] })
      await queryClient.invalidateQueries({ queryKey: ['public', 'wallet-apk'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Could not unpublish'),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet APK"
        description="Upload the VFXT Wallet Android APK. It appears on the public /download page for users."
      />

      <Alert>
        <Smartphone className="h-4 w-4" />
        <AlertTitle>Public download</AlertTitle>
        <AlertDescription>
          After publishing, anyone can get the file at{' '}
          <a className="font-medium underline" href="/download" target="_blank" rel="noreferrer">
            /download
          </a>
          . Prefer a signed release APK for real users.
        </AlertDescription>
      </Alert>

      {release.isLoading ? <LoadingState /> : null}
      {release.isError ? <ErrorState message="Could not load the current APK release." /> : null}

      {release.data?.available ? (
        <Card>
          <CardHeader>
            <CardTitle>Current public release</CardTitle>
            <CardDescription>This is what visitors see on the download page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-ink-muted">Version</span>
                <br />
                <span className="font-medium">
                  {release.data.versionName} ({release.data.versionCode})
                </span>
              </p>
              <p>
                <span className="text-ink-muted">Size</span>
                <br />
                <span className="font-medium">{formatApkSize(release.data.sizeBytes)}</span>
              </p>
              <p className="sm:col-span-2">
                <span className="text-ink-muted">File</span>
                <br />
                <span className="font-medium break-all">{release.data.fileName}</span>
              </p>
              {release.data.notes ? (
                <p className="sm:col-span-2">
                  <span className="text-ink-muted">Notes</span>
                  <br />
                  <span className="whitespace-pre-wrap">{release.data.notes}</span>
                </p>
              ) : null}
              {release.data.publishedAt ? (
                <p className="sm:col-span-2 text-ink-muted">
                  Published {new Date(release.data.publishedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={release.data.downloadUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download current APK
                </a>
              </Button>
              <Button
                variant="danger"
                disabled={unpublish.isPending}
                onClick={() => {
                  if (window.confirm('Remove this APK from the public download page?')) {
                    unpublish.mutate()
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Unpublish
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload new APK</CardTitle>
          <CardDescription>
            Accepts `.apk` up to {formatApkSize(MAX_BYTES)}. Replacing overwrites the public download link after publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apk-version-name">Version name</Label>
              <Input
                id="apk-version-name"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apk-version-code">Version code</Label>
              <Input
                id="apk-version-code"
                inputMode="numeric"
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apk-notes">Release notes (optional)</Label>
            <Textarea
              id="apk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What’s new in this build…"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apk-file">APK file</Label>
            <Input
              id="apk-file"
              ref={fileRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-sm text-ink-muted">
                {file.name} · {formatApkSize(file.size)}
              </p>
            ) : null}
          </div>
          {progress != null ? (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-ink-muted">Uploading… {progress}%</p>
            </div>
          ) : null}
          <Button
            disabled={publish.isPending || !file}
            onClick={() => publish.mutate()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {publish.isPending ? 'Publishing…' : 'Upload & publish'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
