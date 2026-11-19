"use client"
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
import * as React from 'react'
import { useStore } from '@/store/StoreProvider'
import { AppNotification } from '../types'
import { Bell, Check, Clock, CalendarDays, Target, CheckSquare, Settings, Info, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const ICON_MAP: Record<string, any> = {
  task: CheckSquare,
  leave: CalendarDays,
  attendance: Clock,
  performance: Target,
  system: Info
}

const COLOR_MAP: Record<string, string> = {
  task: 'text-blue-600 bg-blue-50',
  leave: 'text-amber-600 bg-amber-50',
  attendance: 'text-emerald-600 bg-emerald-50',
  performance: 'text-purple-600 bg-purple-50',
  system: 'text-ds-neutral-500 bg-ds-neutral-100'
}

export function NotificationDropdown() {
  const { notifications, markAsRead, markAllAsRead } = useStore()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.isRead).length
  const recentNotifications = notifications.slice(0, 5)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-ds-neutral-100 text-ds-neutral-500 hover:text-ds-brand-navy transition-all"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-4 bg-ds-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-ds-neutral-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-ds-neutral-100 flex items-center justify-between bg-ds-neutral-50/50">
            <h3 className="text-ds-body-sm font-bold text-ds-brand-navy">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-ds-brand-green hover:text-ds-brand-green-dark uppercase tracking-wider"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="size-10 text-ds-neutral-200 mx-auto mb-2" />
                <p className="text-ds-body-sm text-ds-neutral-400">No notifications yet.</p>
              </div>
            ) : (
              recentNotifications.map(notification => {
                const IconComp = ICON_MAP[notification.type] || Info
                return (
                  <div 
                    key={notification.id}
                    onClick={() => {
                      markAsRead(notification.id)
                      if (!notification.relatedPath) setIsOpen(false)
                    }}
                    className={`px-4 py-3 flex gap-3 hover:bg-ds-neutral-50 transition-colors cursor-pointer border-b border-ds-neutral-50 last:border-0 ${!notification.isRead ? 'bg-ds-brand-navy/[0.02]' : ''}`}
                  >
                    <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${COLOR_MAP[notification.type]}`}>
                      <IconComp className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-ds-body-sm font-bold truncate ${notification.isRead ? 'text-ds-neutral-600' : 'text-ds-brand-navy'}`}>
                          {notification.title}
                        </span>
                        {!notification.isRead && <div className="size-2 rounded-full bg-ds-brand-green shrink-0" />}
                      </div>
                      <p className="text-ds-caption text-ds-neutral-500 line-clamp-2 mt-0.5">{notification.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-ds-neutral-400 font-medium">
                          {formatTime(notification.createdAt)}
                        </span>
                        {notification.relatedPath && (
                          <Link 
                            href={notification.relatedPath}
                            onClick={() => setIsOpen(false)}
                            className="text-[10px] font-bold text-ds-brand-navy hover:underline flex items-center gap-0.5"
                          >
                            View <ArrowRight className="size-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <Link 
            href="/notifications" 
            onClick={() => setIsOpen(false)}
            className="block py-3 text-center text-ds-body-xs font-bold text-ds-neutral-500 hover:text-ds-brand-navy bg-ds-neutral-50 hover:bg-ds-neutral-100 transition-all border-t border-ds-neutral-100"
          >
            View All Notifications
          </Link>
        </div>
      )}
    </div>
  )
}
