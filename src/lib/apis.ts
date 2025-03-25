import type { FeatureCollection } from 'geojson';
import {
    type LngLatLike,
} from 'svelte-maplibre';

export let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let routeUrl = 'https://bikerouter.de/brouter-engine/brouter';
let geocoderUrl = 'https://photon.komoot.io/api/';

export async function fetchRoutingAPI(from: LngLatLike, to: LngLatLike) {
    let fromString = from.toString();
    let toString = to.toString();

    let staticRouteProperties =
        '&profile=Fastbike-lowtraffic-tertiaries&alternativeidx=0&format=geojson';
    let response =
        await fetch(`${routeUrl}?lonlats=${fromString}|${toString}${staticRouteProperties}
`);
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    let geojson = (await response.json()) as unknown as FeatureCollection;
    if (!geojson) {
        throw new Error('Could not convert router response to FeatureCollection');
    }

    return geojson;
}

export async function fetchGeocodingAPI(locationString: String, limitElements: number) {
    let response = await fetch(`${geocoderUrl}?q=${locationString}&limit=${limitElements}`);
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    let geojson = (await response.json()) as unknown as FeatureCollection;
    if (!geojson) {
        throw new Error('Could not convert router response to FeatureCollection');
    }

    return geojson;
}
