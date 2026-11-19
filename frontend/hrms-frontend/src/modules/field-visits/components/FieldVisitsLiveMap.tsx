"use client"

import * as React from 'react'

export type MapMarker = {
  id: string
  lat: number
  lng: number
  label: string
  kind: 'stop' | 'employee'
  status?: string
}

type Props = {
  markers: MapMarker[]
  height?: number
  className?: string
}

export function FieldVisitsLiveMap({ markers, height = 360, className = '' }: Props) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapApiRef = React.useRef<{ map: import('leaflet').Map; layer: import('leaflet').LayerGroup } | null>(null)

  React.useEffect(() => {
    const container = mapRef.current
    if (!container) return

    let destroyed = false

    async function initMap() {
      const L = (await import('leaflet')).default
      if (destroyed || !mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [18.5912, 73.7389],
        zoom: 12,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)
      mapApiRef.current = { map, layer }

      window.setTimeout(() => map.invalidateSize(), 100)
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
    }
  }, [])

  React.useEffect(() => {
    const api = mapApiRef.current
    if (!api) return

    async function renderMarkers() {
      const L = (await import('leaflet')).default
      const { map, layer } = api!
      layer.clearLayers()

      const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      if (valid.length === 0) {
        map.setView([18.5912, 73.7389], 12)
        return
      }

      const bounds: [number, number][] = []

      for (const m of valid) {
        const isEmployee = m.kind === 'employee'
        const color = isEmployee ? '#2563eb' : m.status === 'VERIFIED' ? '#16a34a' : '#64748b'
        const circle = L.circleMarker([m.lat, m.lng], {
          radius: isEmployee ? 9 : 7,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 2,
        })
        circle.bindPopup(`<strong>${m.label}</strong>${m.status ? `<br/>${m.status}` : ''}`)
        circle.addTo(layer)
        bounds.push([m.lat, m.lng])
      }

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }

    renderMarkers()
  }, [markers])

  return (
    <div
      className={`rounded-lg border border-ds-neutral-200 overflow-hidden z-0 ${className}`}
      style={{ height }}
    >
      <div ref={mapRef} className="h-full w-full" />
    </div>
  )
}
