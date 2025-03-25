<script lang="ts">
	import * as api from '$lib/apis';
	import * as util from '$lib/utils';
	import { type LngLatLike, type LngLatBoundsLike } from 'maplibre-gl';
	import {
		MapLibre,
		RasterTileSource,
		RasterLayer,
		GeoJSON,
		LineLayer,
		DefaultMarker,
		Popup
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
		location: LngLatLike | null; // not null if cached from autocompletion / current user geo location
		suggestions: Array<Suggestion>;
	};
	type AppState = 'SearchingRoute' | 'DisplayingRoute' | 'Routing';

	let appState: AppState = $state('SearchingRoute');
	let devMode = true; // enables dragging of position marker and debugging route display
	let pathGeoJson: FeatureCollection | null = $state(null);
	let turnInstructions: Array<api.TurnInstruction> = $state([]);
	let turnDisplayString = $state('');
	let currentBounds: LngLatBoundsLike | undefined = $state(undefined);
	let currentUserLocation: LngLatLike | undefined = $state(undefined);
	let currentUserBearing: number | undefined = $state(undefined);

	let gpsWatchId: number | null = null;

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

	function determineCurrentWaypointId() {
		if (currentUserLocation === undefined) {
			return -1;
		}
		let minDistance = 99999999;
		let currentWaypointId = -1;
		for (let i = 0; i < turnInstructions.length - 1; ++i) {
			let startPoint = turnInstructions[i].coordinate;
			let endPoint = turnInstructions[i + 1].coordinate;

			let distanceToSegment = util.coordinateToSegmentDistance(
				currentUserLocation,
				startPoint,
				endPoint
			);
			if (distanceToSegment < minDistance) {
				currentWaypointId = i + 1;
				minDistance = distanceToSegment;
			}
		}
		console.log(`User is navigating to waypoint ${currentWaypointId}`);
		return currentWaypointId;
	}

	function handleUserLocationChanged(location: LngLatLike) {
		if (appState !== 'Routing') {
			return;
		}
		if (currentUserLocation === undefined) {
			return;
		}

		let targetId = determineCurrentWaypointId();
		let currentTurnInstruction = turnInstructions[targetId];
		let distanceMeters = util.distanceMeter(currentUserLocation, currentTurnInstruction.coordinate);
		turnDisplayString = currentTurnInstruction.instruction + ' in ' + distanceMeters + 'm';
	}

	async function calculateRoute() {
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
			pathGeoJson = response.geojson;
			turnInstructions = response.turnInstructions;
			if (pathGeoJson.features.length > 0) {
				let geometry = pathGeoJson.features[0].geometry;
				if (geometry.type !== 'LineString') {
					return;
				}
				let lineString = geometry as LineString;
				currentBounds = util.getBoundsFromPath(lineString);
				console.log(`Setting bounds to ${currentBounds}`);

				loadingRoute = false;
				appState = 'DisplayingRoute';
			}
		});
	}

	function setupGeolocationWatch() {
		if (gpsWatchId !== null) {
			return;
		}

		if (navigator.geolocation) {
			let options: PositionOptions = {
				enableHighAccuracy: true,
				maximumAge: 0,
				timeout: 200
			};
			gpsWatchId = navigator.geolocation.watchPosition(
				(position: GeolocationPosition) => {
					currentUserLocation = [position.coords.longitude, position.coords.latitude];
					if (position.coords.heading !== null) {
						currentUserBearing = position.coords.heading;
					}

					handleUserLocationChanged(currentUserLocation);
				},
				null,
				options
			);
		}
	}

	function startRouting() {
		setupGeolocationWatch();

		appState = 'Routing';
	}

	function queryFromGeoposition() {
		setupGeolocationWatch();

		if (currentUserLocation === undefined) {
			setTimeout(queryFromGeoposition, 50);
			return;
		}
		fromInput.input = currentUserLocation.toString();
		fromInput.location = currentUserLocation;
	}

	function queryToGeoposition() {
		setupGeolocationWatch();

		if (currentUserLocation === undefined) {
			setTimeout(queryToGeoposition, 50);
			return;
		}
		toInput.input = currentUserLocation.toString();
		toInput.location = currentUserLocation;
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
	let containerClasses = 'bg-faded-white pointer-events-auto m-1 flex w-1/3 p-2 rounded-lg';
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

	<div class="pointer-events-none absolute z-100 h-screen w-screen">
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

		{#if appState === 'SearchingRoute'}
			<div class={containerClasses}>
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
					<Input onclick={calculateRoute} type="submit" value="Find Route" />
				</form>
			</div>

			<div
				class="bg-faded-white pointer-events-auto m-1 flex w-1/3 flex-col gap-1 p-2"
				class:hidden={!fromInput.focused}
			>
				<Button class="w-full" onclick={queryFromGeoposition}>Use current location</Button>
				<!-- <Button class="w-full">Choose on map</Button> -->
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
				<Button class="w-full" onclick={queryToGeoposition}>Use current location</Button>
				<!-- <Button class="w-full">Choose on map</Button> -->
				{#each toInput.suggestions as toSuggestion}
					<Button class="w-full" onclick={() => applyToSuggestion(toSuggestion)}
						>{toSuggestion[0]}</Button
					>
				{/each}
			</div>
		{/if}

		{#if appState === 'DisplayingRoute'}
			<div class={containerClasses}>
				<div class="flex w-full flex-col gap-1">
					<Button color="red" onclick={() => (appState = 'SearchingRoute')}>Back</Button>
					<Button color="green" onclick={startRouting}>Start navigation</Button>
				</div>
			</div>

			<div class={containerClasses + ' absolute bottom-1'}>Stats coming soon!</div>
		{/if}

		{#if appState === 'Routing'}
			<div class={containerClasses}>
				<Button color="red" onclick={() => (appState = 'SearchingRoute')}>Cancel navigation</Button>
			</div>

			<div
				class={containerClasses +
					' absolute top-20 right-1 h-1/8 w-1/3 items-center justify-center text-xl'}
			>
				{turnDisplayString}
			</div>
		{/if}
	</div>

	<MapLibre
		style="/style.json"
		class={mapClasses}
		standardControls="bottom-right"
		zoom={appState === 'Routing' ? 16 : 1}
		center={appState === 'Routing' ? currentUserLocation : [0, 0]}
		bearing={appState === 'Routing' ? currentUserBearing : 0}
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

		{#if !devMode}
			{#if currentUserLocation}
				<DefaultMarker lngLat={currentUserLocation}></DefaultMarker>
			{/if}
		{/if}

		<!-- display draggable user marker and additional instruction markers -->
		{#if devMode}
			{#if currentUserLocation}
				<DefaultMarker
					draggable
					ondrag={() => handleUserLocationChanged(currentUserLocation!)}
					bind:lngLat={currentUserLocation}
				></DefaultMarker>
			{/if}

			{#each turnInstructions as instruction}
				<DefaultMarker lngLat={instruction.coordinate}>
					<Popup offset={[0, -10]}>
						<div class="z-100 text-lg font-bold">{instruction.instruction}</div>
					</Popup>
				</DefaultMarker>
			{/each}
		{/if}
	</MapLibre>
</div>
