<script lang="ts">
	import * as api from '$lib/apis';
	import * as util from '$lib/utils';
	import { type LngLatLike, type LngLatBoundsLike } from 'maplibre-gl';
	import { MapLibre, GeoJSON, LineLayer, Marker } from 'svelte-maplibre';
	import type { FeatureCollection, LineString } from 'geojson';
	import {
		Button,
		Spinner,
		Input,
		Navbar,
		NavBrand,
		NavHamburger,
		NavLi,
		NavUl,
		Modal
	} from 'flowbite-svelte';

	type InputField = {
		input: string;
		focused: boolean;
		loadingSuggestion: boolean;
		location: LngLatLike | null; // not null if cached from autocompletion / current user geo location
		suggestions: Array<api.Suggestion>;
	};
	type CameraState = {
		center: LngLatLike;
		zoom: number;
		bearing: number;
		pitch: number;
	};
	let cameraState: CameraState = $state({
		center: [10.840601938197864, 49.971698275409054],
		zoom: 5,
		bearing: 0,
		pitch: 0
	});

	type AppState = 'SearchingRoute' | 'DisplayingRoute' | 'Routing' | 'FinishedRouting';
	let appState: AppState = $state('SearchingRoute');

	let currentRoutingProfile: api.RoutingProfile | undefined = $state(undefined);
	let aboutModal = $state(false);

	let wakeLock: WakeLockSentinel | null = null;

	let colors = {
		primary: '#F34213',
		primaryLight: '#E0CA3C',
		secondary: '#3E2F5B',
		green: '#136F63',
		black: '#000F08',
		offwhite: '#EEEEEE'
	};
	const DEFAULT_ZOOM = 12;
	const NAVIGATION_ZOOM = 17;
	const MAX_ZOOM = 18;

	let devMode = true; // enables dragging of position marker and debugging route display
	let pathGeoJson: FeatureCollection | null = $state(null);
	let turnInstructions: Array<api.TurnInstruction> = $state([]);
	let turnDisplayString = $state('');
	let turnDisplayIconName = $state('');
	let currentBounds: LngLatBoundsLike | undefined = $state(undefined);
	let currentUserLocation: LngLatLike | undefined = $state(undefined);
	let currentUserBearing: number = $state(0);

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
	let loadingGps = $state(false);

	function handleUserLocationChanged(location: LngLatLike) {
		if (appState !== 'Routing' && appState !== 'FinishedRouting') {
			return;
		}

		// todo: provide ability to go into "custom" camera mode while navigating
		cameraState.center = location;

		if (appState !== 'Routing') {
			return;
		}

		let targetId = api.determineCurrentWaypointId(location, turnInstructions);
		let currentTurnInstruction = turnInstructions[targetId];
		let distanceMeters = util.distanceMeter(location, currentTurnInstruction.coordinate);
		switch (currentTurnInstruction.instruction) {
			case 'straight':
				turnDisplayIconName = 'arrow-narrow-up';
				break;
			case 'right':
				turnDisplayIconName = 'corner-up-right';
				break;
			case 'left':
				turnDisplayIconName = 'corner-up-left';
				break;
			case 'keep right':
			case 'slight right':
				turnDisplayIconName = 'arrow-bear-right';
				break;
			case 'keep left':
			case 'slight left':
				turnDisplayIconName = 'arrow-bear-left';
				break;
			case 'sharp right':
				turnDisplayIconName = 'arrow-sharp-turn-right';
				break;
			case 'sharp left':
				turnDisplayIconName = 'arrow-sharp-turn-left';
				break;
			default:
				turnDisplayIconName = '';
		}

		let displayDistance = util.roundRemainingDistance(distanceMeters);
		if (turnDisplayIconName === '') {
			turnDisplayString = currentTurnInstruction.instruction + ' in ' + displayDistance + 'm';
		} else {
			turnDisplayString = displayDistance + 'm';
		}

		if (targetId > 0) {
			let lastTurnInstruction = turnInstructions[targetId - 1];
			cameraState.bearing = util.calculateBearing(
				lastTurnInstruction.coordinate,
				currentTurnInstruction.coordinate
			);
		}

		// hacky :)
		if (currentTurnInstruction.instruction === 'Destination' && distanceMeters < 10) {
			finishRouting();
		}
	}

	async function calculateRoute() {
		console.log(`Routing from ${fromInput.input} to ${toInput.input}...`);

		if (fromInput.location === null) {
			fromInput.location = await api.geocode(fromInput.input);
		}
		if (toInput.location === null) {
			toInput.location = await api.geocode(toInput.input);
		}

		if (!fromInput.location) {
			alert(`Could not find coords for ${fromInput.input}`);
			return;
		}
		if (!toInput.location) {
			alert(`Could not find coords for ${toInput.input}`);
			return;
		}

		if (currentRoutingProfile === undefined) {
			alert(`Please select a routing profile.`);
			return;
		}

		console.log(`Fetched coords ${fromInput.location} -> ${toInput.location}`);
		loadingRoute = true;

		api
			.fetchRoutingAPI(fromInput.location, toInput.location, currentRoutingProfile)
			.then((response) => {
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
				timeout: 1000
			};
			gpsWatchId = navigator.geolocation.watchPosition(
				(position: GeolocationPosition) => {
					// in dev mode, let's ignore the GPS to allow us to drag for simulation
					if (devMode && currentUserLocation !== undefined) {
						return;
					}

					loadingGps = false;

					currentUserLocation = [position.coords.longitude, position.coords.latitude];
					if (position.coords.heading !== null) {
						currentUserBearing = position.coords.heading;
					}

					handleUserLocationChanged(currentUserLocation);
				},
				(error) => console.log(error),
				options
			);
			loadingGps = true;
		}
	}

	function toHomeScreen() {
		appState = 'SearchingRoute';

		if (currentUserLocation !== undefined) {
			cameraState.center = currentUserLocation;
		}
		cameraState.zoom = DEFAULT_ZOOM;
		cameraState.bearing = 0;
		cameraState.pitch = 0;

		fromInput = {
			input: '',
			focused: false,
			loadingSuggestion: false,
			location: null,
			suggestions: []
		};
		toInput = {
			input: '',
			focused: false,
			loadingSuggestion: false,
			location: null,
			suggestions: []
		};

		if (wakeLock !== null) {
			wakeLock.release().then(() => (wakeLock = null));
		}
	}

	function startRouting() {
		setupGeolocationWatch();
		if (wakeLock === null) {
			util.requestWakeLock().then((wl) => (wakeLock = wl));
		}

		appState = 'Routing';
		if (currentUserLocation !== undefined) {
			cameraState.center = currentUserLocation;
		}

		cameraState.zoom = NAVIGATION_ZOOM;
		cameraState.pitch = 30;
		if (currentUserLocation !== undefined) {
			cameraState.center = currentUserLocation;
			handleUserLocationChanged(currentUserLocation); // update turn-by-turn, bearing, ...
		}
	}

	function finishRouting() {
		appState = 'FinishedRouting';
		turnInstructions = [];
		pathGeoJson = null;

		cameraState.zoom = NAVIGATION_ZOOM;
		cameraState.bearing = 0;
		cameraState.pitch = 0;
	}

	function queryFromGeoposition() {
		setupGeolocationWatch();

		if (currentUserLocation === undefined) {
			setTimeout(queryFromGeoposition, 100);
			return;
		}
		fromInput.input = currentUserLocation.toString();
		fromInput.location = currentUserLocation;
	}

	function queryToGeoposition() {
		setupGeolocationWatch();

		if (currentUserLocation === undefined) {
			setTimeout(queryToGeoposition, 100);
			return;
		}
		toInput.input = currentUserLocation.toString();
		toInput.location = currentUserLocation;
	}

	async function queryFromSuggestions() {
		console.log(`Querying from suggestion, input: ${fromInput.input}`);

		fromInput.loadingSuggestion = true;
		let suggestions = await api.fetchSuggestions(fromInput.input);
		fromInput.suggestions = Array.from(suggestions.values());
		fromInput.loadingSuggestion = false;
	}

	async function queryToSuggestions() {
		console.log(`Querying to suggestion, input: ${toInput.input}`);

		toInput.loadingSuggestion = true;
		let suggestions = await api.fetchSuggestions(toInput.input);
		toInput.suggestions = Array.from(suggestions.values());
		toInput.loadingSuggestion = false;
	}

	function applyFromSuggestion(suggestion: api.Suggestion) {
		console.log(`Applying from suggestion: ${suggestion}`);
		fromInput.input = suggestion[0];
		fromInput.location = suggestion[1];
		fromInput.focused = false;
		fromInput.suggestions = [];
	}

	function applyToSuggestion(suggestion: api.Suggestion) {
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

	let mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	let mainContainerClasses =
		mainContainerWidth + ' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex rounded-lg';
</script>

<Modal title="About" class="z-2" bind:open={aboutModal} autoclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		<b>breezebike</b> is a modern bike navigation frontend based on the
		<a href="https://brouter.de" class="text-blue-500">BRouter</a> bike routing service. Also check
		out
		<a href="https://brouter.de/brouter-web" class="text-blue-500">brouter-web</a>
		and <a href="https://bikerouter.de" class="text-blue-500">bikerouter.de</a>, the original
		frontends for BRouter. They expose more features if you are interested in planning routes.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		© <a href="https://cgphilipp.de">Philipp Otto</a> - 2025
	</p>
</Modal>

<Modal open={currentRoutingProfile === undefined}>
	<p class="text-offblack mb-4">Select your profile:</p>
	<div class="grid w-full grid-cols-2 gap-2 text-center">
		<Button class="bg-secondary h-16" onclick={() => (currentRoutingProfile = 'Trekking')}
			>Trekking</Button
		>
		<Button class="bg-secondary h-16" onclick={() => (currentRoutingProfile = 'Road bike')}
			>Road bike</Button
		>
		<Button class="bg-secondary h-16" onclick={() => (currentRoutingProfile = 'Gravel')}
			>Gravel</Button
		>
		<Button class="bg-secondary h-16" onclick={() => (currentRoutingProfile = 'Mountainbike')}
			>MTB</Button
		>
	</div>
</Modal>

<div class="h-screen w-screen">
	{#if loadingRoute || loadingGps}
		<div
			class="pointer-events-none absolute z-1 flex h-screen w-screen items-center justify-center"
		>
			<Spinner color="gray" />
		</div>
	{/if}

	<div class="pointer-events-none absolute z-1 h-screen w-screen">
		{#if appState !== 'Routing'}
			<Navbar class="bg-secondary text-offwhite pointer-events-auto" fluid={true}>
				<NavBrand href="/">
					<div class="flex gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="1.8em"
							height="1.8em"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="icon icon-tabler icons-tabler-filled icon-tabler-bike"
						>
							<path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
								d="M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
							/><path d="M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path
								d="M12 19l0 -4l-3 -3l5 -4l2 3l3 0"
							/><path d="M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
						</svg>
						<div class="flex">
							<h1 class="text-xl font-bold">breezebike</h1>
							<div class="text-xs">beta</div>
						</div>
					</div>
				</NavBrand>
				<NavHamburger />
				<NavUl
					ulClass="bg-secondary flex flex-col p-4 mt-4 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:text-sm md:font-medium"
				>
					<NavLi href="#" class="text-offwhite" onclick={() => (currentRoutingProfile = undefined)}>
						Routing profile: {currentRoutingProfile ? currentRoutingProfile : 'None'}
					</NavLi>
					<NavLi href="#" class="text-offwhite" onclick={() => (aboutModal = true)}>About</NavLi>
				</NavUl>
			</Navbar>
		{/if}

		{#if appState === 'SearchingRoute'}
			<div class={mainContainerClasses}>
				<form class="flex w-full flex-col gap-1">
					<div class="flex flex-row gap-1">
						<Input
							type="text"
							placeholder="From"
							bind:value={fromInput.input}
							onfocus={handleFromFocus}
							onkeyup={util.debounce(queryFromSuggestions, 500)}
						/>
						<Button onclick={queryFromGeoposition} class="bg-secondary text-offwhite w-14 p-0">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="icon icon-tabler icons-tabler-filled icon-tabler-gps"
								><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
									d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-.086 5.066c.372 -.837 -.483 -1.692 -1.32 -1.32l-9 4l-.108 .055c-.75 .44 -.611 1.609 .271 1.83l3.418 .853l.855 3.419c.23 .922 1.498 1.032 1.884 .163z"
								/></svg
							>
						</Button>
					</div>

					<div class="flex flex-row gap-1">
						<Input
							type="text"
							placeholder="To"
							bind:value={toInput.input}
							onfocus={handleToFocus}
							onkeyup={util.debounce(queryToSuggestions, 500)}
						/>
						<Button onclick={queryToGeoposition} class="bg-secondary text-offwhite w-14 p-0">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="icon icon-tabler icons-tabler-filled icon-tabler-gps"
								><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
									d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-.086 5.066c.372 -.837 -.483 -1.692 -1.32 -1.32l-9 4l-.108 .055c-.75 .44 -.611 1.609 .271 1.83l3.418 .853l.855 3.419c.23 .922 1.498 1.032 1.884 .163z"
								/></svg
							>
						</Button>
					</div>

					<Input
						class="bg-primary text-offwhite"
						onclick={calculateRoute}
						type="submit"
						value="Find Route"
					/>
				</form>
			</div>

			{#if fromInput.suggestions.length > 0 || fromInput.loadingSuggestion}
				<div
					class={'bg-faded-white pointer-events-auto m-1 flex flex-col gap-1 p-2 ' +
						mainContainerWidth}
					class:hidden={!fromInput.focused}
				>
					<!-- <Button class="w-full">Choose on map</Button> -->

					{#if fromInput.loadingSuggestion}
						<p class="text-center">Loading...</p>
					{/if}

					{#each fromInput.suggestions as fromSuggestion (fromSuggestion[1])}
						<Button
							class="text-offblack border-offblackalpha w-full border bg-white"
							onclick={() => applyFromSuggestion(fromSuggestion)}>{fromSuggestion[0]}</Button
						>
					{/each}
				</div>
			{/if}

			{#if toInput.suggestions.length > 0 || toInput.loadingSuggestion}
				<div
					class={'bg-faded-white pointer-events-auto m-1 flex flex-col gap-1 p-2 ' +
						mainContainerWidth}
					class:hidden={!toInput.focused}
				>
					<!-- <Button class="w-full">Choose on map</Button> -->

					{#if toInput.loadingSuggestion}
						<p class="text-center">Loading...</p>
					{/if}

					{#each toInput.suggestions as toSuggestion (toSuggestion[1])}
						<Button
							class="text-offblack border-offblackalpha w-full border bg-white"
							onclick={() => applyToSuggestion(toSuggestion)}>{toSuggestion[0]}</Button
						>
					{/each}
				</div>
			{/if}
		{/if}

		{#if appState === 'DisplayingRoute'}
			<div class={mainContainerClasses}>
				<div class="flex w-full flex-row gap-1">
					<Button class="bg-primary h-12 w-12 p-3" onclick={toHomeScreen}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="icon icon-tabler icons-tabler-outline icon-tabler-x"
							><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path
								d="M6 6l12 12"
							/></svg
						>
					</Button>
					<Button class="bg-themegreen h-12 flex-grow" onclick={startRouting}
						>Start navigation</Button
					>
				</div>
			</div>

			<div class={mainContainerClasses + ' absolute bottom-1'}>Stats coming soon!</div>
		{/if}

		{#if appState === 'Routing'}
			{#if turnDisplayIconName !== '' || turnDisplayString !== ''}
				<div class={mainContainerClasses + ' items-center justify-center pt-5 pb-5 text-xl'}>
					<div class="flex flex-col items-center gap-2">
						{#if turnDisplayIconName !== ''}
							<div class="h-20 w-20">
								<img
									class="h-full w-full"
									src="/navigation-icons/{turnDisplayIconName}.svg"
									alt="turn navigation icon"
								/>
							</div>
						{/if}
						<div class="text-xl">
							{turnDisplayString}
						</div>
					</div>
				</div>
			{/if}

			<Button
				class="bg-primary pointer-events-auto absolute top-1 left-1 m-1 h-12 w-12 p-3"
				onclick={toHomeScreen}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="icon icon-tabler icons-tabler-outline icon-tabler-x"
					><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path
						d="M6 6l12 12"
					/></svg
				>
			</Button>
		{/if}

		{#if appState === 'FinishedRouting'}
			<div class={mainContainerClasses}>
				<div class="flex w-full flex-col gap-1">
					<Button class="bg-primary" onclick={toHomeScreen}>Start new navigation</Button>
					<div class="m-5 text-center text-xl">You arrived at your destination!</div>
				</div>
			</div>
		{/if}
	</div>

	<MapLibre
		style="/styles/versatiles.json"
		class="relative h-full w-full"
		standardControls="bottom-right"
		center={cameraState.center}
		zoom={cameraState.zoom}
		bearing={cameraState.bearing}
		pitch={cameraState.pitch}
		pitchWithRotate={false}
		bounds={currentBounds}
		maxZoom={MAX_ZOOM}
	>
		{#if pathGeoJson}
			<GeoJSON data={pathGeoJson!}>
				<LineLayer
					layout={{ 'line-cap': 'round', 'line-join': 'round' }}
					paint={{ 'line-color': colors.primary, 'line-width': 3 }}
					beforeLayerType="symbol"
				/>
			</GeoJSON>
		{/if}

		{#if currentUserLocation}
			<Marker
				bind:lngLat={currentUserLocation}
				rotation={currentUserBearing - cameraState.bearing}
				class="h-8 w-8"
				draggable={devMode}
				ondragend={() => handleUserLocationChanged(currentUserLocation!)}
			>
				<svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<polygon points="50,15 80,80 50,65 20,80" fill={colors.secondary} />
				</svg>
			</Marker>
		{/if}

		{#each turnInstructions as instruction (instruction.coordinate)}
			<Marker lngLat={instruction.coordinate} class="h-4 w-4">
				<svg
					fill={colors.primary}
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					width="100%"
					height="100%"
					viewBox="0 0 24 24"
				>
					<path
						fill-rule="evenodd"
						d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.408-5.5a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2h-.01ZM10 10a1 1 0 1 0 0 2h1v3h-1a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-1v-4a1 1 0 0 0-1-1h-2Z"
						clip-rule="evenodd"
					/>
				</svg>
			</Marker>
		{/each}
	</MapLibre>
</div>
