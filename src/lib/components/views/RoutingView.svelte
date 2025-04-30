<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { turnDisplayString, turnDisplayIconName, isOffPath } from '$lib/navigationState.svelte';
	import { toHomeScreen, recalculateRouteFromCurrentLocation } from '$lib/navigationLogic'; // Added recalculateRouteFromCurrentLocation

	const mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	const mainContainerClasses =
		mainContainerWidth +
		' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex flex-col rounded-lg'; // Added flex-col
</script>

{#if $turnDisplayIconName !== '' || $turnDisplayString !== '' || $isOffPath}
	<div class={mainContainerClasses + ' items-center justify-center gap-4 pt-5 pb-5 text-xl'}>
		<!-- Show turn instruction if available -->
		{#if $turnDisplayIconName !== '' || $turnDisplayString !== ''}
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
		{/if}

		<!-- Show recalculate button if off path -->
		{#if $isOffPath}
			<Button class="bg-primary pointer-events-auto" onclick={recalculateRouteFromCurrentLocation}>
				Calculate new route
			</Button>
		{/if}
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
