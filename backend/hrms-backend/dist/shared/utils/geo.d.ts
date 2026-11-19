/** Haversine distance in meters (same formula as attendance-location backend). */
export declare function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function isInsideGeofence(userLat: number, userLng: number, centerLat: number, centerLng: number, radiusMeters: number): {
    inside: boolean;
    distanceMeters: number;
};
