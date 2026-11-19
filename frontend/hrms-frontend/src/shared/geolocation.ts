export type GeoCoords = { lat: number; lng: number; accuracy?: number }

export function getCurrentPosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => reject(new Error(err.message || 'Unable to read GPS location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
  })
}
