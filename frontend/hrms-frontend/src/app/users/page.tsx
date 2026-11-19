"use client"

import * as React from 'react'
import { UserManagementPage } from '@/modules/users/components/UserManagementPage'

export default function UsersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Loading users…
        </div>
      }
    >
      <UserManagementPage />
    </React.Suspense>
  )
}
