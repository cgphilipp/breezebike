import * as util from '$lib/utils';
import type { FeatureCollection } from 'geojson';
import { type LngLatLike } from 'svelte-maplibre';
import { ParsedGPX, parseGPX } from '@we-gold/gpxjs';

// export const tileUrl = 'https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}';
// export const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const routeUrl = 'https://bikerouter.de/brouter-engine/brouter';
const geocoderUrl = 'https://photon.komoot.io/api/';

export type TurnInstruction = {
	coordinate: LngLatLike;
	instruction: string;
};

export type Route = {
	geojson: FeatureCollection;
	turnInstructions: Array<TurnInstruction>;
};

export type Suggestion = [string, LngLatLike];

function readTurnNavigationFromGPX(gpx: ParsedGPX): Array<TurnInstruction> {
	const result: Array<TurnInstruction> = [];
	for (const waypoint of gpx.waypoints) {
		if ('name' in waypoint) {
			result.push({
				instruction: waypoint.name!,
				coordinate: [waypoint.longitude, waypoint.latitude]
			});
		}
	}
	return result;
}

export async function geocode(location: string): Promise<LngLatLike | null> {
	const geojson = await fetchGeocodingAPI(location, 1);

	for (const feature of geojson.features) {
		if (feature.geometry.type == 'Point') {
			return [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
		}
	}

	return null;
}

export async function fetchSuggestions(input: string) {
	const geojson = await fetchGeocodingAPI(input, 5);

	const newSuggestions = new Set<Suggestion>();
	for (const feature of geojson.features) {
		let coord: LngLatLike = [0, 0];
		if (feature.geometry.type == 'Point') {
			coord = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
		}
		const properties = feature.properties;
		if (properties === null) {
			continue;
		}
		const hasStreet = 'street' in properties;
		const hasName = 'name' in properties;

		let suggestionString = '';
		if (hasStreet && hasName) {
			suggestionString += `${properties.name}, ${properties.street}`;
		}
		else if (hasName) {
			suggestionString += `${properties.name}`;
		}
		else if (hasStreet) {
			suggestionString += `${properties.street}`;
		}

		if ('postcode' in properties!) {
			suggestionString += ', ' + properties.postcode;
		}
		if ('city' in properties) {
			suggestionString += ' ' + properties.city;
		}

		newSuggestions.add([suggestionString, coord]);
	}
	return newSuggestions;
}

export function determineCurrentWaypointId(
	location: LngLatLike,
	turnInstructions: Array<TurnInstruction>
) {
	let minDistance = Number.MAX_VALUE;
	let currentWaypointId = -1;
	for (let i = 0; i < turnInstructions.length - 1; ++i) {
		const startPoint = turnInstructions[i].coordinate;
		const endPoint = turnInstructions[i + 1].coordinate;

		const distanceToSegment = util.coordinateToSegmentDistance(location, startPoint, endPoint);
		if (distanceToSegment < minDistance) {
			currentWaypointId = i + 1;
			minDistance = distanceToSegment;
		}
	}
	return currentWaypointId;
}

export async function fetchRoutingAPI(from: LngLatLike, to: LngLatLike): Promise<Route> {
	const fromString = from.toString();
	const toString = to.toString();

	// Load route in GPX format with turn information enabled. This way we can get both the
	// path + the turn information in one query. The GPX can then be converted to GeoJSON
	// for integration in Maplibre GL JS.
	const staticRouteProperties =
		'&profile=Fastbike-lowtraffic-tertiaries&alternativeidx=0&format=gpx&timode=5';
	const response = await fetch(
		`${routeUrl}?lonlats=${fromString}|${toString}${staticRouteProperties}`
	);
	if (!response.ok) {
		throw new Error(response.statusText);
	}

	const gpxString = await response.text();
	const [gpx, error] = parseGPX(gpxString);
	if (error) throw error;

	const turnInstructions = readTurnNavigationFromGPX(gpx);

	// add instructions for start and end, they are not included originally
	turnInstructions.unshift({
		instruction: 'Start',
		coordinate: from
	});
	turnInstructions.push({
		instruction: 'Destination',
		coordinate: to
	});

	return {
		geojson: gpx.toGeoJSON() as FeatureCollection,
		turnInstructions: turnInstructions
	};
}

async function fetchGeocodingAPI(locationString: string, limitElements: number) {
	const response = await fetch(`${geocoderUrl}?q=${locationString}&limit=${limitElements}`);
	if (!response.ok) {
		throw new Error(response.statusText);
	}

	const geojson = (await response.json()) as unknown as FeatureCollection;
	if (!geojson) {
		throw new Error('Could not convert router response to FeatureCollection');
	}

	return geojson;
}
