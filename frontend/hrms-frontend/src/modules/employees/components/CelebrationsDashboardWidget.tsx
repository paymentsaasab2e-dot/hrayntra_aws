"use client"

import * as React from 'react'
import Link from 'next/link'
import { Cake, Award, Sparkles, PartyPopper, Heart, ArrowUpRight } from 'lucide-react'
import { Avatar, Button } from '@hryantra/ui'
import { api } from '@/shared/api'
import { CelebrationItem } from '../types'

export function CelebrationsDashboardWidget() {
  const [items, setItems] = React.useState<CelebrationItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    api.employees
      .getCelebrations({ timeframe: 'all' })
      .then((res) => {
        if (mounted && res?.success && res.data?.items) {
          setItems(res.data.items.slice(0, 4))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          <div className="h-12 bg-slate-50 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const todayItem = items.find((i) => i.isToday)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <PartyPopper className="size-4 text-pink-600" />
            <span className="text-sm font-bold text-slate-900">Celebrations & Milestones</span>
          </div>
          <Link
            href="/employees?tab=celebrations"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
          >
            Directory <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {/* Special Highlight for Today */}
        {todayItem && (
          <div className="mb-3.5 p-3 rounded-xl bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 border border-pink-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {todayItem.employee.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={todayItem.employee.avatar}
                    alt={todayItem.employee.name}
                    className="size-9 rounded-full object-cover border border-white shadow-xs"
                  />
                ) : (
                  <Avatar
                    initials={todayItem.employee.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                    size="sm"
                    gradient="amber"
                  />
                )}
                <span className="absolute -top-1 -right-1 text-xs">🎉</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {todayItem.employee.name}
                </span>
                <span className="text-[11px] font-medium text-pink-700 truncate">
                  {todayItem.milestoneTitle} • Today!
                </span>
              </div>
            </div>

            <Link href="/employees?tab=celebrations">
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5 bg-white text-pink-600 hover:text-pink-700 border-pink-200 shadow-2xs shrink-0"
              >
                <Heart className="size-3 text-pink-500 fill-pink-500 mr-1" />
                Wish
              </Button>
            </Link>
          </div>
        )}

        {/* Upcoming List */}
        <div className="space-y-2.5">
          {items
            .filter((i) => !todayItem || i.id !== todayItem.id)
            .slice(0, 3)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                    {item.type === 'BIRTHDAY' ? (
                      <Cake className="size-3.5 text-pink-500" />
                    ) : item.type === 'WORK_ANNIVERSARY' ? (
                      <Award className="size-3.5 text-amber-500" />
                    ) : (
                      <Sparkles className="size-3.5 text-teal-500" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.employee.name}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {item.milestoneTitle}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {item.badge}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-100 text-center">
        <Link
          href="/employees?tab=celebrations"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          View Company Celebrations Directory →
        </Link>
      </div>
    </div>
  )
}
