'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LoginScreen } from '@/modules/auth/components/LoginScreen'
import { useStore } from '@/store/StoreProvider'

export default function TenantLoginPage() {
  const router = useRouter()
  const { isAuthenticated, sessionReady, currentUserRole } = useStore()

  React.useEffect(() => {
    if (!sessionReady || !isAuthenticated) return
    router.replace(currentUserRole === 'PlatformOwner' ? '/superadmin/dashboard' : '/')
  }, [sessionReady, isAuthenticated, currentUserRole, router])

  if (!sessionReady) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
  }

  if (isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Redirecting…</div>
  }

  return <LoginScreen mode="tenant" />
}
