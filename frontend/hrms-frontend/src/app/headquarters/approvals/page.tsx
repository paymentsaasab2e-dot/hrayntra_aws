'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HeadquartersApprovalsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/approvals')
  }, [router])
  return null
}
