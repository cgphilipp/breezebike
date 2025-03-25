import {
    type LngLatBoundsLike
} from 'svelte-maplibre';
import type { LineString } from 'geojson';

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