import type { FeatureCollection } from 'geojson';
import {
    type LngLatLike
} from 'svelte-maplibre';
import { ParsedGPX, parseGPX } from '@we-gold/gpxjs';

export let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let routeUrl = 'https://bikerouter.de/brouter-engine/brouter';
let geocoderUrl = 'https://photon.komoot.io/api/';

export type TurnInstruction = {
    coordinate: LngLatLike;
    instruction: string;
};

export type Route = {
    geojson: FeatureCollection;
    turnInstructions: Array<TurnInstruction>;
};

function readTurnNavigationFromGPX(gpx: ParsedGPX): Array<TurnInstruction> {
    let result: Array<TurnInstruction> = [];
    for (let waypoint of gpx.waypoints) {
        if ('name' in waypoint) {
            result.push({
                instruction: waypoint.name!,
                coordinate: [waypoint.longitude, waypoint.latitude],
            })
        }
    }
    return result;
}

export async function fetchRoutingAPI(from: LngLatLike, to: LngLatLike): Promise<Route> {
    let fromString = from.toString();
    let toString = to.toString();

    // Load route in GPX format with turn information enabled. This way we can get both the
    // path + the turn information in one query. The GPX can then be converted to GeoJSON
    // for integration in Maplibre GL JS.
    let staticRouteProperties =
        '&profile=Fastbike-lowtraffic-tertiaries&alternativeidx=0&format=gpx&timode=5';
    let response =
        await fetch(`${routeUrl}?lonlats=${fromString}|${toString}${staticRouteProperties}`);
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    let gpxString = await response.text();
    const [gpx, error] = parseGPX(gpxString)
    if (error) throw error

    let turnInstructions = readTurnNavigationFromGPX(gpx);

    // add instructions for start and end, they are not included originally
    turnInstructions.unshift({
        instruction: "Start",
        coordinate: from,
    });
    turnInstructions.push({
        instruction: "Destination",
        coordinate: to,
    });

    return {
        geojson: gpx.toGeoJSON() as FeatureCollection,
        turnInstructions: turnInstructions
    };
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
