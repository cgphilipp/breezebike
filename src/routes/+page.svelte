<script lang="ts">
	import * as api from '$lib/apis';
	import * as util from '$lib/utils';
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
	import {
		Button,
		Spinner,
		Input,
		Navbar,
		NavBrand,
		NavHamburger,
		NavLi,
		NavUl
	} from 'flowbite-svelte';

	type Suggestion = [string, LngLatLike];
	type InputField = {
		input: string;
		focused: boolean;
		loadingSuggestion: boolean;
		location: LngLatLike | null; // could be cached from autocompletion
		suggestions: Array<Suggestion>;
	};

	let pathGeoJson: FeatureCollection | null = $state(null);
	let currentBounds: LngLatBoundsLike | undefined = $state(undefined);

	let fromInput: InputField = $state({
		input: '',
		focused: false,
		loadingSuggestion: false,
		location: null,
		suggestions: []
	});

	let toInput: InputField = $state({
		input: '',
		focused: false,
		loadingSuggestion: false,
		location: null,
		suggestions: []
	});

	let loadingRoute = $state(false);

	function calculateNavigationFromGeoJson(geojson: any) {
		console.log(geojson);
	}

	async function route() {
		loadingRoute = true;
		console.log(`Routing from ${fromInput.input} to ${toInput.input}...`);

		if (fromInput.location === null) {
			fromInput.location = await geocode(fromInput.input);
		}
		if (toInput.location === null) {
			toInput.location = await geocode(toInput.input);
		}

		if (!fromInput.location) {
			throw Error(`Could not find coords for ${fromInput.input}`);
		}
		if (!toInput.location) {
			throw Error(`Could not find coords for ${toInput.input}`);
		}

		console.log(`Fetched coords ${fromInput.location} -> ${toInput.location}`);

		api.fetchRoutingAPI(fromInput.location, toInput.location).then((response) => {
			pathGeoJson = response;
			let navigationInstrutions = calculateNavigationFromGeoJson(pathGeoJson);
			if (pathGeoJson.features.length > 0) {
				let geometry = pathGeoJson.features[0].geometry;
				if (geometry.type !== 'LineString') {
					return;
				}
				let lineString = geometry as LineString;
				currentBounds = util.getBoundsFromPath(lineString);
				console.log(`Setting bounds to ${currentBounds}`);

				loadingRoute = false;
			}
		});
	}

	async function querySuggestions(input: string) {
		let geojson = await api.fetchGeocodingAPI(input, 4);

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

		fromInput.loadingSuggestion = true;
		let suggestions = await querySuggestions(fromInput.input);
		fromInput.suggestions = Array.from(suggestions.values());
		fromInput.loadingSuggestion = false;
	}

	async function queryToSuggestions() {
		console.log(`Querying to suggestion, input: ${toInput.input}`);

		toInput.loadingSuggestion = true;
		let suggestions = await querySuggestions(toInput.input);
		toInput.suggestions = Array.from(suggestions.values());
		toInput.loadingSuggestion = false;
	}

	function applyFromSuggestion(suggestion: Suggestion) {
		console.log(`Applying from suggestion: ${suggestion}`);
		fromInput.input = suggestion[0];
		fromInput.location = suggestion[1];
		fromInput.focused = false;
		fromInput.suggestions = [];
	}

	function applyToSuggestion(suggestion: Suggestion) {
		console.log(`Applying to suggestion: ${suggestion}`);
		toInput.input = suggestion[0];
		toInput.location = suggestion[1];
		toInput.focused = false;
		toInput.suggestions = [];
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
		let geojson = await api.fetchGeocodingAPI(location, 1);

		for (let feature of geojson.features) {
			if (feature.geometry.type == 'Point') {
				return [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
			}
		}

		return null;
	}

	let mapClasses = 'relative w-full h-full';
	let borderColor = $state('#0000ffaa');
</script>

<div class="h-screen w-screen">
	{#if loadingRoute}
		<div
			class="pointer-events-none absolute z-100 flex h-screen w-screen items-center justify-center"
		>
			<Spinner color="gray" />
		</div>
	{/if}

	<div class="pointer-events-none absolute z-100">
		<Navbar class="w-screen">
			<NavBrand href="/">
				<h1 class="me-3 h-6 text-xl font-bold sm:h-9">routemybike</h1>
			</NavBrand>
			<!-- <NavHamburger /> -->
			<!-- <NavUl>
			<NavLi href="/">Home</NavLi>
			<NavLi href="/about">About</NavLi>
			<NavLi href="/docs/components/navbar">Navbar</NavLi>
			<NavLi href="/pricing">Pricing</NavLi>
			<NavLi href="/contact">Contact</NavLi>
		</NavUl> -->
		</Navbar>

		<div class="bg-faded-white pointer-events-auto m-1 flex w-1/3 p-2">
			<form class="flex w-full flex-col gap-1">
				<Input
					type="text"
					placeholder="From"
					bind:value={fromInput.input}
					onfocus={handleFromFocus}
					onkeyup={util.debounce(queryFromSuggestions, 500)}
				/>
				<Input
					type="text"
					placeholder="To"
					bind:value={toInput.input}
					onfocus={handleToFocus}
					onkeyup={util.debounce(queryToSuggestions, 500)}
				/>
				<Input onclick={route} type="submit" value="Find Route" />
			</form>
		</div>

		<div
			class="bg-faded-white pointer-events-auto m-1 flex w-1/3 flex-col gap-1 p-2"
			class:hidden={!fromInput.focused}
		>
			<Button class="w-full">Use current location</Button>
			<Button class="w-full">Choose on map</Button>
			{#each fromInput.suggestions as fromSuggestion}
				<Button class="w-full" onclick={() => applyFromSuggestion(fromSuggestion)}
					>{fromSuggestion[0]}</Button
				>
			{/each}
		</div>

		<div
			class="bg-faded-white pointer-events-auto m-1 flex w-1/3 flex-col gap-1 p-2"
			class:hidden={!toInput.focused}
		>
			<Button class="w-full">Use current location</Button>
			<Button class="w-full">Choose on map</Button>
			{#each toInput.suggestions as toSuggestion}
				<Button class="w-full" onclick={() => applyToSuggestion(toSuggestion)}
					>{toSuggestion[0]}</Button
				>
			{/each}
		</div>
	</div>

	<MapLibre
		style="/style.json"
		class={mapClasses}
		standardControls="bottom-right"
		pitchWithRotate={false}
		bounds={currentBounds}
	>
		<RasterTileSource tiles={[api.tileUrl]} tileSize={256}>
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
