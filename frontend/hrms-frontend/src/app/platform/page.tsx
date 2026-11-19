'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy alias — Platform Console lives at /superadmin */
export default function PlatformRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/superadmin/dashboard')
  }, [router])
  return <div className="p-6 text-sm text-slate-500">Redirecting to Platform Console…</div>
}
