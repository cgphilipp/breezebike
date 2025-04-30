<script lang="ts">
	import { MapLibre, GeoJSON, LineLayer, Marker } from 'svelte-maplibre';
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

	// State & Constants (using $state and writable stores)
	import {
		cameraState, // $state
		fromInput, // $state
		toInput, // $state
		turnInstructions, // $state
		appState, // writable
		currentRoutingProfile, // writable
		aboutModal, // writable
		profileChooseModal, // writable
		pathGeoJson, // writable
		turnDisplayString, // writable
		turnDisplayIconName, // writable
		currentBounds, // writable
		currentUserLocation, // writable
		currentUserBearing, // writable
		loadingRoute, // writable
		loadingGps, // writable
		colors, // const
		MAX_ZOOM // const
	} from '$lib/navigationState.svelte';

	// Logic Functions
	import {
		handleUserLocationChanged,
		calculateRoute,
		toHomeScreen,
		startRouting,
		queryFromGeoposition,
		queryToGeoposition,
		queryFromSuggestions,
		queryToSuggestions,
		applyFromSuggestion,
		applyToSuggestion,
		handleFromFocus,
		handleToFocus
	} from '$lib/navigationLogic';

	// Helpers
	import * as util from '$lib/utils';
	import { dev } from '$app/environment'; // Import dev environment flag

	// Local component constants
	const mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	const mainContainerClasses =
		mainContainerWidth + ' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex rounded-lg';
</script>

<Modal title="About" class="z-2" bind:open={$aboutModal} autoclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		<b>breezebike</b> is a modern bike navigation frontend based on the
		<a href="https://brouter.de" class="text-blue-500">BRouter</a> bike routing service. Also check
		out
		<a href="https://brouter.de/brouter-web" class="text-blue-500">brouter-web</a>
		and <a href="https://bikerouter.de" class="text-blue-500">bikerouter.de</a>, the original
		frontends for BRouter. They expose more features if you are interested in planning routes.
	</p>
	Powered by
	<ul class="ml-5 list-disc">
		<li>
			<a href="https://www.openstreetmap.org/about" class="text-blue-500">OpenStreetMap</a> (map data)
		</li>
		<li>
			<a href="https://versatiles.org/" class="text-blue-500">Versatiles</a> (map style and tile server)
		</li>
		<li>
			<a href="https://photon.komoot.io/" class="text-blue-500">Komoot photon</a> (autocomplete)
		</li>
	</ul>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		© 2025 <a href="https://cgphilipp.de" class="text-blue-500">Philipp Otto</a>
	</p>
</Modal>

<Modal bind:open={$profileChooseModal}>
	<p class="text-offblack mb-4">Select your profile:</p>
	<div class="grid w-full grid-cols-2 gap-2 text-center">
		<Button
			class="bg-secondary h-16"
			onclick={() => {
				currentRoutingProfile.set('Trekking');
				profileChooseModal.set(false);
			}}>Trekking</Button
		>
		<Button
			class="bg-secondary h-16"
			onclick={() => {
				currentRoutingProfile.set('Road bike');
				profileChooseModal.set(false);
			}}>Road bike</Button
		>
		<Button
			class="bg-secondary h-16"
			onclick={() => {
				currentRoutingProfile.set('Gravel');
				profileChooseModal.set(false);
			}}>Gravel</Button
		>
		<Button
			class="bg-secondary h-16"
			onclick={() => {
				currentRoutingProfile.set('Mountainbike');
				profileChooseModal.set(false);
			}}>MTB</Button
		>
	</div>
</Modal>

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
					<NavLi href="#" class="text-offwhite" onclick={() => profileChooseModal.set(true)}>
						Routing profile: {$currentRoutingProfile ? $currentRoutingProfile : 'None'}
					</NavLi>
					<NavLi href="#" class="text-offwhite" onclick={() => aboutModal.set(true)}>About</NavLi>
				</NavUl>
			</Navbar>
		{/if}

		{#if $appState === 'SearchingRoute'}
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

					<Button class="bg-primary text-offwhite" on:click={calculateRoute} type="button"
						>Find Route</Button
					><!-- Changed type to button to prevent default form submission -->
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

		{#if $appState === 'DisplayingRoute'}
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

		{#if $appState === 'Routing'}
			{#if $turnDisplayIconName !== '' || $turnDisplayString !== ''}
				<div class={mainContainerClasses + ' items-center justify-center pt-5 pb-5 text-xl'}>
					<div class="flex flex-col items-center gap-2">
						{#if $turnDisplayIconName !== ''}
							<div class="h-20 w-20">
								<img
									class="h-full w-full"
									src="/navigation-icons/{$turnDisplayIconName}.svg"
									alt="turn navigation icon"
								/>
							</div>
						{/if}
						<div class="text-xl">
							{$turnDisplayString}
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

		{#if $appState === 'FinishedRouting'}
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
