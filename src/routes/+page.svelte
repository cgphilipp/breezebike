<script lang="ts">
	import {
		MapLibre,
		RasterTileSource,
		RasterLayer,
		GeoJSON,
		LineLayer,
		type LngLatLike,
		type LngLatBoundsLike
	} from 'svelte-maplibre';
	import type { FeatureCollection, LineString } from 'geojson';

	type Suggestion = [string, LngLatLike];
	type InputField = {
		input: string;
		focused: boolean;
		location: LngLatLike | null; // could be cached from autocompletion
	};

	let pathGeoJson: FeatureCollection | null = $state(null);
	let currentBounds: LngLatBoundsLike | undefined = $state(undefined);
	let fromSuggestions: Array<Suggestion> = $state([]);
	let toSuggestions: Array<Suggestion> = $state([]);

	let fromInput: InputField = $state({
		input: '',
		focused: false,
		location: null
	});

	let toInput: InputField = $state({
		input: '',
		focused: false,
		location: null
	});

	const debounce = (callback: Function, wait = 300) => {
		let timeout: ReturnType<typeof setTimeout>;

		return (...args: any[]) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => callback(...args), wait);
		};
	};

	function getBoundsFromPath(path: LineString) {
		let result: LngLatBoundsLike = [9999, 9999, -9999, -9999];
		for (let point of path.coordinates) {
			result[0] = Math.min(result[0], point[0]);
			result[1] = Math.min(result[1], point[1]);
			result[2] = Math.max(result[2], point[0]);
			result[3] = Math.max(result[3], point[1]);
		}
		return result;
	}

	async function route() {
		console.log(`Routing from ${fromInput.input} to ${toInput.input}...`);

		let [coordFrom, coordTo] = await Promise.all([
			geocode(fromInput.input),
			geocode(toInput.input)
		]);

		if (!coordFrom) {
			throw Error(`Could not find coords for ${fromInput.input}`);
		}
		if (!coordTo) {
			throw Error(`Could not find coords for ${toInput.input}`);
		}

		console.log(`Fetched coords ${coordFrom} -> ${coordTo}`);

		fetchRoutingAPI(coordFrom, coordTo).then((response) => {
			pathGeoJson = response;
			if (pathGeoJson.features.length > 0) {
				let geometry = pathGeoJson.features[0].geometry;
				if (geometry.type !== 'LineString') {
					return;
				}
				let lineString = geometry as LineString;
				currentBounds = getBoundsFromPath(lineString);
				console.log(`Setting bounds to ${currentBounds}`);
			}
		});
	}

	async function querySuggestions(input: string) {
		let geojson = await fetchGeocodingAPI(input, 4);

		let newSuggestions = new Set<Suggestion>();
		for (let feature of geojson.features) {
			let coord: LngLatLike = [0, 0];
			if (feature.geometry.type == 'Point') {
				coord = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
			}
			let properties = feature.properties;

			let suggestionString = '';
			if ('street' in properties!) {
				suggestionString += properties.street;
				if ('postcode' in properties!) {
					suggestionString += ', ' + properties.postcode;
				}
				if ('city' in properties!) {
					suggestionString += ' ' + properties.city;
				}
			} else if ('name' in properties!) {
				suggestionString += properties.name;
				if ('postcode' in properties!) {
					suggestionString += ', ' + properties.postcode;
				}
				if ('city' in properties!) {
					suggestionString += ' ' + properties.city;
				}
			}

			newSuggestions.add([suggestionString, coord]);
		}
		return newSuggestions;
	}

	async function queryFromSuggestions() {
		console.log(`Querying from suggestion, input: ${fromInput.input}`);
		let suggestions = await querySuggestions(fromInput.input);
		fromSuggestions = Array.from(suggestions.values());
	}

	async function queryToSuggestions() {
		console.log(`Querying to suggestion, input: ${toInput.input}`);
		let suggestions = await querySuggestions(toInput.input);
		toSuggestions = Array.from(suggestions.values());
	}

	function applyFromSuggestion(suggestion: Suggestion) {
		console.log(`Applying from suggestion: ${suggestion}`);
		fromInput.input = suggestion[0];
		fromInput.location = suggestion[1];
		fromInput.focused = false;
	}

	function applyToSuggestion(suggestion: Suggestion) {
		console.log(`Applying to suggestion: ${suggestion}`);
		toInput.input = suggestion[0];
		toInput.location = suggestion[1];
		toInput.focused = false;
	}

	function handleFromFocus() {
		fromInput.focused = true;
		toInput.focused = false;
	}

	function handleToFocus() {
		toInput.focused = true;
		fromInput.focused = false;
	}

	async function geocode(location: string): Promise<LngLatLike | null> {
		let geojson = await fetchGeocodingAPI(location, 1);

		for (let feature of geojson.features) {
			if (feature.geometry.type == 'Point') {
				return [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
			}
		}

		return null;
	}

	async function fetchRoutingAPI(from: LngLatLike, to: LngLatLike) {
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

	async function fetchGeocodingAPI(locationString: String, limitElements: number) {
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

	let mapClasses = 'relative w-full h-full';
	let borderColor = $state('#0000ffaa');

	let tileUrl = $state('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
	let routeUrl = $state('https://bikerouter.de/brouter-engine/brouter');
	let geocoderUrl = $state('https://photon.komoot.io/api/');
</script>

<div class="h-screen w-screen">
	<div class="pointer-events-none absolute z-100">
		<div class="bg-faded-black pointer-events-auto w-screen">
			<h1 class="p-2 text-xl font-bold">routemybike</h1>
		</div>
		<form class="bg-faded-white pointer-events-auto m-1 flex w-1/3 flex-col gap-2 rounded-lg p-2">
			<input
				class="input bg-faded-black"
				type="text"
				placeholder="From"
				bind:value={fromInput.input}
				onfocus={handleFromFocus}
				onkeyup={debounce(queryFromSuggestions, 500)}
			/>
			<input
				class="input bg-faded-black"
				type="text"
				placeholder="To"
				bind:value={toInput.input}
				onfocus={handleToFocus}
				onkeyup={debounce(queryToSuggestions, 500)}
			/>
			<input
				onclick={route}
				type="submit"
				class="btn preset-filled-primary-500"
				value="Find Route"
			/>
		</form>

		<div
			class="bg-faded-black pointer-events-auto m-1 flex w-1/3 flex-col gap-2 rounded-lg p-2"
			class:hidden={!fromInput.focused}
		>
			<div>Use current location</div>
			<div>Choose on map</div>
			{#each fromSuggestions as fromSuggestion}
				<button class="text-left" type="button" onclick={() => applyFromSuggestion(fromSuggestion)}
					>{fromSuggestion[0]}</button
				>
			{/each}
		</div>

		<div
			class="bg-faded-black pointer-events-auto m-1 flex w-1/3 flex-col gap-2 rounded-lg p-2"
			class:hidden={!toInput.focused}
		>
			<div>Use current location</div>
			<div>Choose on map</div>
			{#each toSuggestions as toSuggestion}
				<button class="text-left" type="button" onclick={() => applyToSuggestion(toSuggestion)}
					>{toSuggestion[0]}</button
				>
			{/each}
		</div>
	</div>

	<MapLibre
		style="/style.json"
		class={mapClasses}
		standardControls="bottom-right"
		bounds={currentBounds}
	>
		<RasterTileSource tiles={[tileUrl]} tileSize={256}>
			<RasterLayer
				paint={{
					'raster-opacity': 1.0
				}}
			/>
		</RasterTileSource>

		{#if pathGeoJson}
			<GeoJSON data={pathGeoJson!}>
				<LineLayer
					layout={{ 'line-cap': 'round', 'line-join': 'round' }}
					paint={{ 'line-color': borderColor, 'line-width': 3 }}
					beforeLayerType="symbol"
				/>
			</GeoJSON>
		{/if}
	</MapLibre>
</div>
