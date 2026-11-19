"use client"

import * as React from 'react'

type LocationMapPreviewProps = {
  lat: number
  lng: number
  radiusMeters?: number
  height?: number
  className?: string
  interactive?: boolean
  onPick?: (lat: number, lng: number) => void
}

function isValidCoord(value: number) {
  return Number.isFinite(value)
}

function clearLeafletContainer(el: HTMLElement) {
  const anyEl = el as HTMLElement & { _leaflet_id?: number }
  if (anyEl._leaflet_id != null) {
    delete anyEl._leaflet_id
  }
  el.replaceChildren()
}

export function LocationMapPreview({
  lat,
  lng,
  radiusMeters = 100,
  height = 280,
  className = '',
  interactive = false,
  onPick,
}: LocationMapPreviewProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapApiRef = React.useRef<{
    map: import('leaflet').Map
    marker: import('leaflet').Marker
    circle: import('leaflet').Circle
  } | null>(null)
  const onPickRef = React.useRef(onPick)
  onPickRef.current = onPick

  const safeLat = isValidCoord(lat) ? lat : 18.5912
  const safeLng = isValidCoord(lng) ? lng : 73.7389

  // Create map once per mount (or when interactive mode changes).
  React.useEffect(() => {
    const container = mapRef.current
    if (!container) return

    let destroyed = false

    async function initMap() {
      const L = (await import('leaflet')).default
      if (destroyed || !mapRef.current) return

      // @ts-expect-error leaflet internal
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      clearLeafletContainer(mapRef.current)

      const map = L.map(mapRef.current, {
        center: [safeLat, safeLng],
        zoom: 16,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker([safeLat, safeLng]).addTo(map)
      const circle = L.circle([safeLat, safeLng], {
        radius: radiusMeters,
        color: '#0f3d4c',
        fillColor: '#7cb342',
        fillOpacity: 0.2,
      }).addTo(map)

      mapApiRef.current = { map, marker, circle }

      const fitToCircle = () => {
        if (destroyed || !mapApiRef.current) return
        try {
          map.invalidateSize()
          map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18 })
        } catch {
          map.setView([safeLat, safeLng], 16)
        }
      }

      map.whenReady(fitToCircle)
      window.setTimeout(fitToCircle, 100)

      if (interactive) {
        map.on('click', (e) => {
          const nextLat = e.latlng.lat
          const nextLng = e.latlng.lng
          marker.setLatLng([nextLat, nextLng])
          circle.setLatLng([nextLat, nextLng])
          try {
            map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18 })
          } catch {
            map.setView([nextLat, nextLng], map.getZoom())
          }
          onPickRef.current?.(nextLat, nextLng)
        })
      }
    }

    initMap()

    return () => {
      destroyed = true
      const api = mapApiRef.current
      if (api) {
        api.map.off()
        api.map.remove()
        mapApiRef.current = null
      }
      if (mapRef.current) {
        clearLeafletContainer(mapRef.current)
      }
    }
  }, [interactive])

  // Update marker/circle when props change — do not recreate the map.
  React.useEffect(() => {
    const api = mapApiRef.current
    if (!api) return

    const { map, marker, circle } = api
    if (!map.getContainer()?.isConnected) return

    marker.setLatLng([safeLat, safeLng])
    circle.setLatLng([safeLat, safeLng])
    circle.setRadius(radiusMeters)

    const frame = window.requestAnimationFrame(() => {
      if (!mapApiRef.current) return
      try {
        map.invalidateSize()
        map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18 })
      } catch {
        map.setView([safeLat, safeLng], map.getZoom() || 16)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [safeLat, safeLng, radiusMeters])

  return (
    <div
      className={`rounded-lg border border-ds-neutral-200 overflow-hidden z-0 ${className}`}
      style={{ height }}
    >
      <div ref={mapRef} className="h-full w-full" />
    </div>
  )
}
