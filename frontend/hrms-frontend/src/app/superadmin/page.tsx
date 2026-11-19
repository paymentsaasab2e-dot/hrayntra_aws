'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuperadminHomePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/superadmin/dashboard')
  }, [router])
  return <div className="p-6 text-sm text-slate-500">Opening Platform Dashboard…</div>
}
