<script lang="ts">
	import { MapLibre, GeoJSON, LineLayer, Marker } from 'svelte-maplibre';
	import { Spinner, Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';

	// State & Constants
	import {
		cameraState,
		turnInstructions,
		appState,
		currentRoutingProfile,
		aboutModal,
		profileChooseModal,
		pathGeoJson,
		currentBounds,
		currentUserLocation,
		currentUserBearing,
		loadingRoute,
		loadingGps,
		colors,
		MAX_ZOOM
	} from '$lib/navigationState.svelte';

	// Logic Functions
	import { handleUserLocationChanged } from '$lib/navigationLogic';

	// Helpers
	import { dev } from '$app/environment';

	// Components
	import AboutModal from '$lib/components/modals/AboutModal.svelte';
	import ProfileChooseModal from '$lib/components/modals/ProfileChooseModal.svelte';
	import SearchingRouteView from '$lib/components/views/SearchingRouteView.svelte';
	import DisplayingRouteView from '$lib/components/views/DisplayingRouteView.svelte';
	import RoutingView from '$lib/components/views/RoutingView.svelte';
	import FinishedRoutingView from '$lib/components/views/FinishedRoutingView.svelte';
</script>

<AboutModal />
<ProfileChooseModal />

<div class="h-screen w-screen">
	{#if $loadingRoute || $loadingGps}
		<div
			class="pointer-events-none absolute z-1 flex h-screen w-screen items-center justify-center"
		>
			<Spinner color="gray" />
		</div>
	{/if}

	<div class="pointer-events-none absolute z-1 h-screen w-screen">
		{#if $appState !== 'Routing'}
			<Navbar class="bg-secondary text-offwhite pointer-events-auto" fluid={true}>
				<NavBrand href="/">
					<div class="flex items-center gap-2">
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
					<NavLi href="#" class="text-offwhite" onclick={() => profileChooseModal.set(true)}>
						Routing profile: {$currentRoutingProfile ? $currentRoutingProfile : 'None'}
					</NavLi>
					<NavLi href="#" class="text-offwhite" onclick={() => aboutModal.set(true)}>About</NavLi>
				</NavUl>
			</Navbar>
		{/if}

		{#if $appState === 'SearchingRoute'}
			<SearchingRouteView />
		{/if}

		{#if $appState === 'DisplayingRoute'}
			<DisplayingRouteView />
		{/if}

		{#if $appState === 'Routing'}
			<RoutingView />
		{/if}

		{#if $appState === 'FinishedRouting'}
			<FinishedRoutingView />
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
		bounds={$currentBounds}
		maxZoom={MAX_ZOOM}
	>
		{#if $pathGeoJson}
			<GeoJSON data={$pathGeoJson!}>
				<LineLayer
					layout={{ 'line-cap': 'round', 'line-join': 'round' }}
					paint={{ 'line-color': colors.primary, 'line-width': 3 }}
					beforeLayerType="symbol"
				/>
			</GeoJSON>
		{/if}

		{#if $currentUserLocation}
			<Marker
				bind:lngLat={$currentUserLocation}
				rotation={$currentUserBearing - cameraState.bearing}
				class="h-8 w-8"
				draggable={dev}
				ondragend={() => handleUserLocationChanged($currentUserLocation!)}
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
