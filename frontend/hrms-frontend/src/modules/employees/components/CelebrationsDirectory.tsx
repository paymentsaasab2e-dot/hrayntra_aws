"use client"

import * as React from 'react'
import {
  Cake,
  Award,
  Sparkles,
  PartyPopper,
  Search,
  Calendar,
  Send,
  Heart,
  MessageCircle,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  Filter,
} from 'lucide-react'
import { Button, Avatar } from '@hryantra/ui'
import { api } from '@/shared/api'
import { CelebrationItem, CelebrationsResponse, CelebrationWish } from '../types'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const QUICK_GREETINGS: Record<string, string[]> = {
  BIRTHDAY: [
    '🎂 Wishing you a wonderful birthday filled with happiness and great success!',
    '🎉 Happy Birthday! May this year bring you exciting new milestones!',
    '🌟 Hope your special day is as incredible as you are! Happy Birthday!',
  ],
  WORK_ANNIVERSARY: [
    '🏆 Happy Work Anniversary! Thank you for your immense dedication and impact!',
    '🎉 Congratulations on this milestone anniversary! So proud to have you on the team!',
    '🌟 Celebrating your valuable journey with us! Here is to many more successful years!',
  ],
  NEW_JOINER: [
    '🚀 A very warm welcome to our team! Thrilled to have you onboard!',
    '👋 Welcome to the company! Wishing you a fantastic journey ahead with us!',
    '🎉 Welcome! Excited to collaborate and achieve great milestones together!',
  ],
}

export function CelebrationsDirectory() {
  const [data, setData] = React.useState<CelebrationsResponse | null>(null)
  const [wishes, setWishes] = React.useState<CelebrationWish[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters
  const [activeTab, setActiveTab] = React.useState<'ALL' | 'TODAY_WEEK' | 'BIRTHDAYS' | 'ANNIVERSARIES' | 'NEW_JOINERS'>('ALL')
  const [selectedMonth, setSelectedMonth] = React.useState<string>('ALL')
  const [searchQuery, setSearchQuery] = React.useState('')

  // Send Wish Modal State
  const [selectedItemForWish, setSelectedItemForWish] = React.useState<CelebrationItem | null>(null)
  const [wishMessage, setWishMessage] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)
  const [sendSuccessMsg, setSendSuccessMsg] = React.useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [celRes, wishesRes] = await Promise.all([
        api.employees.getCelebrations(),
        api.employees.getCelebrationWishes().catch(() => ({ data: [] })),
      ])

      if (celRes?.success && celRes.data) {
        setData(celRes.data)
      } else {
        setError(celRes?.message || 'Failed to load celebrations')
      }

      if (Array.isArray(wishesRes?.data)) {
        setWishes(wishesRes.data)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load celebrations')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered Items
  const filteredItems = React.useMemo(() => {
    if (!data?.items) return []
    let list = [...data.items]

    // Tab filter
    if (activeTab === 'TODAY_WEEK') {
      list = list.filter((i) => i.isToday || i.isThisWeek)
    } else if (activeTab === 'BIRTHDAYS') {
      list = list.filter((i) => i.type === 'BIRTHDAY')
    } else if (activeTab === 'ANNIVERSARIES') {
      list = list.filter((i) => i.type === 'WORK_ANNIVERSARY')
    } else if (activeTab === 'NEW_JOINERS') {
      list = list.filter((i) => i.type === 'NEW_JOINER')
    }

    // Month filter
    if (selectedMonth !== 'ALL') {
      const monthIdx = parseInt(selectedMonth, 10)
      list = list.filter((i) => new Date(i.date).getMonth() === monthIdx)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.employee.name.toLowerCase().includes(q) ||
          i.employee.designation.toLowerCase().includes(q) ||
          i.employee.department.toLowerCase().includes(q) ||
          i.milestoneTitle.toLowerCase().includes(q)
      )
    }

    return list
  }, [data, activeTab, selectedMonth, searchQuery])

  // Open Wish Modal
  const handleOpenWishModal = (item: CelebrationItem) => {
    setSelectedItemForWish(item)
    const defaults = QUICK_GREETINGS[item.type] || QUICK_GREETINGS.BIRTHDAY
    setWishMessage(defaults[0])
    setSendSuccessMsg(null)
  }

  // Submit Wish
  const handleSendWish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItemForWish || !wishMessage.trim()) return

    try {
      setIsSending(true)
      const res = await api.employees.sendCelebrationWish({
        targetEmployeeId: selectedItemForWish.employee.id,
        type: selectedItemForWish.type,
        message: wishMessage,
      })

      if (res?.success) {
        setSendSuccessMsg(`🎉 Warm wishes delivered to ${selectedItemForWish.employee.name}!`)
        if (res.data) {
          setWishes((prev) => [res.data, ...prev])
        }
        setTimeout(() => {
          setSelectedItemForWish(null)
          setSendSuccessMsg(null)
        }, 1800)
      } else {
        alert(res?.message || 'Failed to deliver greeting')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to deliver greeting')
    } finally {
      setIsSending(false)
    }
  }

  // Summary counts computed from items with fallbacks
  const computedStats = React.useMemo(() => {
    const items = data?.items || []
    const bdays = items.filter((i) => i.type === 'BIRTHDAY')
    const annivs = items.filter((i) => i.type === 'WORK_ANNIVERSARY')
    const joiners = items.filter((i) => i.type === 'NEW_JOINER')
    const todayEvents = items.filter((i) => i.isToday)
    const weekEvents = items.filter((i) => i.isToday || i.isThisWeek)

    const birthdaysThisMonth = data?.stats?.birthdaysThisMonth ?? bdays.filter((i) => i.isThisMonth).length
    const anniversariesThisMonth = data?.stats?.anniversariesThisMonth ?? annivs.filter((i) => i.isThisMonth).length
    const newJoinersCount = data?.stats?.newJoinersCount ?? joiners.length
    const todayCount = data?.stats?.todayCount ?? todayEvents.length

    return {
      birthdaysDisplay: birthdaysThisMonth > 0 ? birthdaysThisMonth : bdays.length,
      birthdaysSub: birthdaysThisMonth > 0 ? `${birthdaysThisMonth} This Month · ${bdays.length} in Year` : `${bdays.length} Upcoming in Year`,
      anniversariesDisplay: anniversariesThisMonth > 0 ? anniversariesThisMonth : annivs.length,
      anniversariesSub: anniversariesThisMonth > 0 ? `${anniversariesThisMonth} This Month · ${annivs.length} in Year` : `${annivs.length} Milestones Ahead`,
      newJoinersDisplay: newJoinersCount,
      newJoinersSub: newJoinersCount > 0 ? `${newJoinersCount} Active Past 30d` : 'No Recent Joiners',
      eventsDisplay: weekEvents.length,
      eventsSub: todayCount > 0 ? `${todayCount} Today · ${weekEvents.length} This Week` : `${weekEvents.length} This Week`,
      totalUpcoming: items.length,
    }
  }, [data])

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-pink-50 to-rose-100/60 border border-pink-200/80 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-pink-700 uppercase tracking-wide">Birthdays</span>
            <span className="text-2xl font-black text-pink-900 mt-1">
              {computedStats.birthdaysDisplay}
            </span>
            <span className="text-[11px] text-pink-600/90 font-medium">{computedStats.birthdaysSub}</span>
          </div>
          <div className="size-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-pink-600">
            <Cake className="size-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/80 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Anniversaries</span>
            <span className="text-2xl font-black text-amber-950 mt-1">
              {computedStats.anniversariesDisplay}
            </span>
            <span className="text-[11px] text-amber-700/90 font-medium">{computedStats.anniversariesSub}</span>
          </div>
          <div className="size-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-amber-600">
            <Award className="size-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-emerald-100/60 border border-teal-200/80 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-teal-800 uppercase tracking-wide">New Joiners</span>
            <span className="text-2xl font-black text-teal-950 mt-1">
              {computedStats.newJoinersDisplay}
            </span>
            <span className="text-[11px] text-teal-700/90 font-medium">{computedStats.newJoinersSub}</span>
          </div>
          <div className="size-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-teal-600">
            <Sparkles className="size-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200/80 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Today & Week</span>
            <span className="text-2xl font-black text-indigo-950 mt-1">
              {computedStats.eventsDisplay}
            </span>
            <span className="text-[11px] text-indigo-700/90 font-medium">{computedStats.eventsSub}</span>
          </div>
          <div className="size-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600">
            <PartyPopper className="size-6" />
          </div>
        </div>
      </div>

      {/* ── Filter Bar & Month Selector ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Upcoming ({data?.items?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('TODAY_WEEK')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'TODAY_WEEK'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Today & This Week
          </button>
          <button
            onClick={() => setActiveTab('BIRTHDAYS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'BIRTHDAYS'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            🎂 Birthdays
          </button>
          <button
            onClick={() => setActiveTab('ANNIVERSARIES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'ANNIVERSARIES'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            🏆 Work Anniversaries
          </button>
          <button
            onClick={() => setActiveTab('NEW_JOINERS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'NEW_JOINERS'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            🚀 New Joiners
          </button>
        </div>

        {/* Search & Month Dropdown */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shrink-0"
          >
            <option value="ALL">All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Celebration Cards Grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="size-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading celebrations directory...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <p className="font-semibold text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData} className="mt-3">
            Retry
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <PartyPopper className="size-10 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No celebrations found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            There are no birthdays, anniversaries, or new joiners matching your selected filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isToday = item.isToday
            const isMilestone = item.isMilestone
            const isBday = item.type === 'BIRTHDAY'
            const isAnniv = item.type === 'WORK_ANNIVERSARY'
            const isNew = item.type === 'NEW_JOINER'

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between bg-white rounded-2xl p-5 border transition-all duration-200 hover:shadow-md ${
                  isToday
                    ? 'border-pink-300 ring-2 ring-pink-400/30 shadow-pink-50'
                    : isMilestone
                    ? 'border-amber-300 ring-1 ring-amber-300 shadow-amber-50'
                    : 'border-slate-200'
                }`}
              >
                {/* Event Type & Timing Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isToday
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm animate-pulse'
                        : isMilestone
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                        : isBday
                        ? 'bg-pink-50 text-pink-700 border border-pink-200'
                        : isAnniv
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-teal-50 text-teal-700 border border-teal-200'
                    }`}
                  >
                    {isBday ? <Cake className="size-3" /> : isAnniv ? <Award className="size-3" /> : <Sparkles className="size-3" />}
                    <span>{item.badge}</span>
                  </span>

                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Calendar className="size-3 text-slate-400" />
                    {item.displayDate}
                  </span>
                </div>

                {/* Employee Info Header */}
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    {item.employee.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.employee.avatar}
                        alt={item.employee.name}
                        className="size-13 rounded-2xl object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <Avatar
                        initials={item.employee.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                        size="lg"
                        gradient={isBday ? 'indigo' : isAnniv ? 'amber' : 'emerald'}
                      />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[14px] font-bold text-slate-900 truncate">
                      {item.employee.name}
                    </span>
                    <span className="text-xs text-slate-600 font-medium truncate">
                      {item.employee.designation}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {item.employee.department}
                      </span>
                      {item.employee.locationName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="size-3" />
                            {item.employee.locationName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Milestone Detail Banner */}
                <div className="my-3.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {item.milestoneTitle}
                  </span>
                  {item.daysRemaining > 0 && (
                    <span className="text-[11px] font-medium text-slate-500">
                      in {item.daysRemaining} {item.daysRemaining === 1 ? 'day' : 'days'}
                    </span>
                  )}
                  {item.daysSinceJoining !== undefined && item.daysSinceJoining > 0 && (
                    <span className="text-[11px] font-medium text-teal-600">
                      Active {item.daysSinceJoining}d
                    </span>
                  )}
                </div>

                {/* Action: Send Wishes */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">
                    {item.employee.employeeId}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenWishModal(item)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border-indigo-200"
                  >
                    <Heart className="size-3.5 text-pink-500 fill-pink-500" />
                    <span>Send Wishes</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent Peer Wishes Feed ── */}
      {wishes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Peer Greetings & Wishes</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">{wishes.length} greetings sent</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {wishes.slice(0, 6).map((wish) => (
              <div
                key={wish.id}
                className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {wish.senderName} ➔ {wish.targetName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(wish.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 italic line-clamp-2">
                  &ldquo;{wish.message}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Send Wishes Modal ── */}
      {selectedItemForWish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PartyPopper className="size-5" />
                <h3 className="font-bold text-sm">Send Celebratory Greeting</h3>
              </div>
              <button
                onClick={() => setSelectedItemForWish(null)}
                className="text-white/80 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {sendSuccessMsg ? (
              <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="size-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="size-8" />
                </div>
                <h4 className="text-base font-bold text-slate-800">{sendSuccessMsg}</h4>
                <p className="text-xs text-slate-500">Your teammate has received your celebration message!</p>
              </div>
            ) : (
              <form onSubmit={handleSendWish} className="p-6 flex flex-col gap-4">
                {/* Recipient preview */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Avatar
                    initials={selectedItemForWish.employee.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()}
                    size="md"
                    gradient="indigo"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900">
                      {selectedItemForWish.employee.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedItemForWish.milestoneTitle} ({selectedItemForWish.employee.designation})
                    </span>
                  </div>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Quick Templates</label>
                  <div className="flex flex-col gap-1.5">
                    {(QUICK_GREETINGS[selectedItemForWish.type] || QUICK_GREETINGS.BIRTHDAY).map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWishMessage(t)}
                        className={`text-left p-2 rounded-lg text-xs transition-colors border ${
                          wishMessage === t
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-medium'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Message */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Personal Message</label>
                  <textarea
                    rows={3}
                    value={wishMessage}
                    onChange={(e) => setWishMessage(e.target.value)}
                    placeholder="Write a custom note..."
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItemForWish(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    disabled={isSending || !wishMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                  >
                    {isSending ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Send Greetings</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
