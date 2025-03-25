import { type LngLatLike, type LngLatBoundsLike } from 'maplibre-gl';
import type { LineString } from 'geojson';

import pkg from 'maplibre-gl';
const { LngLat } = pkg;

// use this to react to changes only after `wait` ms
export const debounce = (callback: Function, wait = 300) => {
    let timeout: ReturnType<typeof setTimeout>;

    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(...args), wait);
    };
};

export function getBoundsFromPath(path: LineString) {
    let result: LngLatBoundsLike = [9999, 9999, -9999, -9999];
    for (let point of path.coordinates) {
        result[0] = Math.min(result[0], point[0]);
        result[1] = Math.min(result[1], point[1]);
        result[2] = Math.max(result[2], point[0]);
        result[3] = Math.max(result[3], point[1]);
    }
    return result;
}

export function distanceMeter(pointA: LngLatLike, PointB: LngLatLike) {
    // https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
    let pA = LngLat.convert(pointA);
    let pB = LngLat.convert(PointB);
    var R = 6378.137; // Radius of earth in KM
    var dLat = (pB.lat * Math.PI) / 180 - (pA.lat * Math.PI) / 180;
    var dLon = (pB.lng * Math.PI) / 180 - (pA.lng * Math.PI) / 180;
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pA.lat * Math.PI) / 180) *
        Math.cos((pB.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return Math.round(d * 1000); // meters
}

function pointToSegmentDistanceSquared(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;

    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;

    var xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    }
    else if (param > 1) {
        xx = x2;
        yy = y2;
    }
    else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    var dx = x - xx;
    var dy = y - yy;
    return dx * dx + dy * dy;
}

export function coordinateToSegmentDistance(coord: LngLatLike, startSegment: LngLatLike, endSegment: LngLatLike) {
    let coord_ = LngLat.convert(coord);
    let start_ = LngLat.convert(startSegment);
    let end_ = LngLat.convert(endSegment);
    return pointToSegmentDistanceSquared(coord_.lng, coord_.lat, start_.lng, start_.lat, end_.lng, end_.lat);
}

