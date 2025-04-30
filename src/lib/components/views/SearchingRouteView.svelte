<script lang="ts">
	import { Button, Input } from 'flowbite-svelte';
	import { fromInput, toInput } from '$lib/navigationState.svelte';
	import {
		calculateRoute,
		queryFromGeoposition,
		queryToGeoposition,
		queryFromSuggestions,
		queryToSuggestions,
		applyFromSuggestion,
		applyToSuggestion,
		handleFromFocus,
		handleToFocus
	} from '$lib/navigationLogic';

	import * as util from '$lib/utils';

	const mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	const mainContainerClasses =
		mainContainerWidth + ' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex rounded-lg';
</script>

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
		class={'bg-faded-white pointer-events-auto m-1 flex flex-col gap-1 p-2 ' + mainContainerWidth}
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
		class={'bg-faded-white pointer-events-auto m-1 flex flex-col gap-1 p-2 ' + mainContainerWidth}
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
