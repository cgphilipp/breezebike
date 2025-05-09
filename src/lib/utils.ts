import { type LngLatLike, type LngLatBoundsLike } from 'maplibre-gl';
import type { LineString } from 'geojson';

import pkg from 'maplibre-gl';
const { LngLat } = pkg;

// use this to react to changes only after `wait` ms
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const debounce = (callback: Function, wait = 300) => {
	let timeout: ReturnType<typeof setTimeout>;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (...args: any[]) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => callback(...args), wait);
	};
};

export async function requestWakeLock() {
	try {
		const wakeLock = await navigator.wakeLock.request('screen');
		console.log('Wake lock is active');

		return wakeLock;
	} catch (err) {
		console.error(`Error while requesting wake lock: ${err}`);
	}
	return null;
}

export function getBoundsFromPath(path: LineString, paddingPercent: number) {
	const result: LngLatBoundsLike = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];
	for (const point of path.coordinates) {
		result[0] = Math.min(result[0], point[0]);
		result[1] = Math.min(result[1], point[1]);
		result[2] = Math.max(result[2], point[0]);
		result[3] = Math.max(result[3], point[1]);
	}
	const diffX = result[2] - result[0];
	const diffY = result[3] - result[1];
	result[0] -= diffX * paddingPercent;
	result[1] -= diffY * paddingPercent;
	result[2] += diffX * paddingPercent;
	result[3] += diffY * paddingPercent;
	return result;
}

export function distanceMeter(pointA: LngLatLike, PointB: LngLatLike) {
	// https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
	const pA = LngLat.convert(pointA);
	const pB = LngLat.convert(PointB);
	const R = 6378.137; // Radius of earth in KM
	const dLat = (pB.lat * Math.PI) / 180 - (pA.lat * Math.PI) / 180;
	const dLon = (pB.lng * Math.PI) / 180 - (pA.lng * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((pA.lat * Math.PI) / 180) *
		Math.cos((pB.lat * Math.PI) / 180) *
		Math.sin(dLon / 2) *
		Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const d = R * c;
	return Math.round(d * 1000); // meters
}

export function calculateBearing(pointA: LngLatLike, PointB: LngLatLike) {
	const pA = LngLat.convert(pointA);
	const pB = LngLat.convert(PointB);

	const toRadians = (deg: number) => (deg * Math.PI) / 180;
	const toDegrees = (rad: number) => (rad * 180) / Math.PI;

	// Convert coordinates to radians
	const phi1 = toRadians(pA.lat);
	const phi2 = toRadians(pB.lat);
	const deltaLng = toRadians(pB.lng - pA.lng);

	// Calculate bearing
	const y = Math.sin(deltaLng) * Math.cos(phi2);
	const x = Math.cos(phi1) * Math.sin(phi2) -
		Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);

	let radians = Math.atan2(y, x);
	radians = toDegrees(radians);
	return (radians + 360) % 360; // normalize to 0-360 degrees
}

function pointToSegmentDistanceSquared(
	x: number,
	y: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number
) {
	const A = x - x1;
	const B = y - y1;
	const C = x2 - x1;
	const D = y2 - y1;

	const dot = A * C + B * D;
	const len_sq = C * C + D * D;
	let param = -1;
	if (len_sq != 0)
		//in case of 0 length line
		param = dot / len_sq;

	let xx, yy;

	if (param < 0) {
		xx = x1;
		yy = y1;
	} else if (param > 1) {
		xx = x2;
		yy = y2;
	} else {
		xx = x1 + param * C;
		yy = y1 + param * D;
	}

	const dx = x - xx;
	const dy = y - yy;
	return dx * dx + dy * dy;
}

export function coordinateToSegmentDistance(
	coord: LngLatLike,
	startSegment: LngLatLike,
	endSegment: LngLatLike
) {
	const coord_ = LngLat.convert(coord);
	const start_ = LngLat.convert(startSegment);
	const end_ = LngLat.convert(endSegment);
	return pointToSegmentDistanceSquared(
		coord_.lng,
		coord_.lat,
		start_.lng,
		start_.lat,
		end_.lng,
		end_.lat
	);
}

export function roundRemainingDistance(distance: number) {
	if (distance < 0) {
		return 0;
	}
	const thresholds = [50, 150, 500];
	const roundTo = [10, 25, 50];


	for (let i = 0; i < thresholds.length; ++i) {
		if (distance < thresholds[i]) {
			return distance - (distance % roundTo[i]);
		}
	}

	const roundToMax = 100;
	return distance - (distance % roundToMax);
}

/**
 * Calculates the minimum distance (using Haversine formula) from a point
 * to any of the vertices in a LineString geometry.
 *
 * @param point The point (LngLatLike).
 * @param line The LineString geometry.
 * @returns The minimum distance in meters, or Infinity if the line has no coordinates.
 */
export function distanceToLineStringVertices(point: LngLatLike, line: LineString): number {
	if (!line || !line.coordinates || line.coordinates.length === 0) {
		return Infinity;
	}

	let minDistance = Infinity;
	for (const vertex of line.coordinates) {
		// Cast vertex to LngLatLike to satisfy distanceMeter's type requirement
		const dist = distanceMeter(point, vertex as LngLatLike);
		if (dist < minDistance) {
			minDistance = dist;
		}
	}
	return minDistance;
}
