"use client"

import * as React from 'react'
import { MasterDataManagement } from '@/modules/org/components/MasterDataManagement'

export default function MasterDataRoutePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 pb-12">
      <MasterDataManagement />
    </div>
  )
}
