<script lang="ts">
	import { Button } from 'flowbite-svelte';

	// Logic Functions
	import { toHomeScreen } from '$lib/navigationLogic';

	// Local component constants
	const mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	const mainContainerClasses =
		mainContainerWidth + ' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex rounded-lg';
</script>

<div class={mainContainerClasses}>
	<div class="flex w-full flex-col gap-1">
		<Button class="bg-primary" onclick={toHomeScreen}>Start new navigation</Button>
		<div class="m-5 text-center text-xl">You arrived at your destination!</div>
	</div>
</div>
