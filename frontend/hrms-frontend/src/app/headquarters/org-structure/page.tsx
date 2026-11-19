'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HeadquartersOrgRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/org-structure')
  }, [router])
  return null
}
