import * as React from 'react'

export type DataDomain = 'attendance' | 'leave' | 'roster' | 'policies' | 'employees' | 'approvals' | 'all'

export interface DataRefreshDetail {
  domain: DataDomain
  timestamp: number
  payload?: any
}

const EVENT_NAME = 'hrms:data-refresh'
const STORAGE_KEY = 'hrms:data-sync-event'

/**
 * Dispatches an event across the current window and all other open tabs/windows
 * to inform components that leave, attendance, or roster data was updated.
 */
export function notifyDataChanged(domain: DataDomain = 'all', payload?: any) {
  if (typeof window === 'undefined') return

  const detail: DataRefreshDetail = {
    domain,
    timestamp: Date.now(),
    payload,
  }

  // 1. In-tab custom event
  try {
    const event = new CustomEvent(EVENT_NAME, { detail })
    window.dispatchEvent(event)
  } catch (e) {
    console.warn('Failed to dispatch in-window custom event:', e)
  }

  // 2. Cross-tab storage event
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(detail))
  } catch (e) {
    // Quota exceeded or disabled storage ignored
  }
}

/**
 * Hook to subscribe to real-time data changes across portals.
 * Fires whenever notifyDataChanged is called in this tab or another tab for the specified domain(s).
 */
export function useDataSync(
  domains: DataDomain | DataDomain[],
  onRefresh: (detail: DataRefreshDetail) => void
) {
  const handlerRef = React.useRef(onRefresh)
  handlerRef.current = onRefresh

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const domainList = Array.isArray(domains) ? domains : [domains]

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DataRefreshDetail>
      const detail = customEvent.detail
      if (!detail) return
      if (domainList.includes('all') || detail.domain === 'all' || domainList.includes(detail.domain)) {
        handlerRef.current(detail)
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const detail: DataRefreshDetail = JSON.parse(e.newValue)
          if (domainList.includes('all') || detail.domain === 'all' || domainList.includes(detail.domain)) {
            handlerRef.current(detail)
          }
        } catch (err) {}
      }
    }

    window.addEventListener(EVENT_NAME, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [Array.isArray(domains) ? domains.join(',') : domains])
}
