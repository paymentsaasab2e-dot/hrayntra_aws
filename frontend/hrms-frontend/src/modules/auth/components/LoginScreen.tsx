'use client'
import * as React from 'react'
import { Button, Input, SectionCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'

type LoginMode = 'tenant' | 'platform'

export function LoginScreen({ mode = 'tenant' }: { mode?: LoginMode }) {
  const { login } = useStore()
  const isPlatform = mode === 'platform'

  const [email, setEmail] = React.useState(
    isPlatform ? 'platform.owner@hrms.local' : 'superadmin@hrms.local'
  )
  const [password, setPassword] = React.useState(
    isPlatform ? 'PlatformOwner@123' : 'SuperAdmin@123'
  )
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async () => {
    try {
      setError(null)
      setLoading(true)
      await login({ email, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`flex min-h-screen items-center justify-center p-6 ${
        isPlatform ? 'bg-slate-950' : 'bg-ds-neutral-100'
      }`}
    >
      <SectionCard
        title={isPlatform ? 'Platform Console — Sign in' : 'Framework — Sign in'}
        className={`w-full max-w-md ${isPlatform ? 'border-slate-700 bg-slate-900 text-slate-100' : ''}`}
      >
        <div className="flex flex-col gap-4">
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              isPlatform
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                : 'border-blue-100 bg-blue-50 text-blue-700'
            }`}
          >
            {isPlatform ? (
              <>
                Platform owner only. Client Tenant admins must use the company portal.
                <br />
                Demo: <strong>platform.owner@hrms.local</strong> / <strong>PlatformOwner@123</strong>
              </>
            ) : (
              <>
                Tenant admin (client HQ): <strong>superadmin@hrms.local</strong> /{' '}
                <strong>SuperAdmin@123</strong>
                <br />
                Platform owner: use <strong>/superadmin/login</strong>
                <br />
                HR demo: <strong>sarah.connor@hryantra.com</strong> / <strong>password123</strong>
              </>
            )}
          </div>

          <label className="text-ds-label text-ds-neutral-700">Email</label>
          <Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />

          <label className="text-ds-label text-ds-neutral-700">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button variant="default" onClick={handleLogin} disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
