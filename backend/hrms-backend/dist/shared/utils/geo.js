"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistanceMeters = haversineDistanceMeters;
exports.isInsideGeofence = isInsideGeofence;
/** Haversine distance in meters (same formula as attendance-location backend). */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
    const earthRadiusMeters = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
}
function isInsideGeofence(userLat, userLng, centerLat, centerLng, radiusMeters) {
    const distance = haversineDistanceMeters(userLat, userLng, centerLat, centerLng);
    return { inside: distance <= radiusMeters, distanceMeters: distance };
}
//# sourceMappingURL=geo.js.map