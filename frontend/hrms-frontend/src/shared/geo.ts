export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusMeters = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

export function getOutsideAreaWarning(
  userLat: number,
  userLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  locationName?: string,
  remotePunchEnabled: boolean = false
) {
  const distance = haversineDistanceMeters(userLat, userLng, centerLat, centerLng)
  if (distance <= radiusMeters) return null
  const label = locationName || 'assigned location'
  if (remotePunchEnabled) {
    return `You are ${Math.round(distance)}m from ${label} (allowed: ${radiusMeters}m). Office punch may be rejected; remote punch enabled: distance will be recorded.`
  }
  return `You are ${Math.round(distance)}m from ${label} (allowed: ${radiusMeters}m). Punch may be rejected.`
}
