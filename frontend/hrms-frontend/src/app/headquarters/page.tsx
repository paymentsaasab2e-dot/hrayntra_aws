'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HeadquartersPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return <div className="p-6 text-sm text-slate-500">Opening Headquarters…</div>
}
