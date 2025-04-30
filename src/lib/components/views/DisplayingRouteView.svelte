<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { toHomeScreen, startRouting } from '$lib/navigationLogic';

	const mainContainerWidth = 'sm:w-full md:w-1/2 lg:w-1/3';
	const mainContainerClasses =
		mainContainerWidth + ' bg-faded-white backdrop-blur-sm pointer-events-auto p-2 flex rounded-lg';
</script>

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
		<Button class="bg-themegreen h-12 flex-grow" onclick={startRouting}>Start navigation</Button>
	</div>
</div>

<div class={mainContainerClasses + ' absolute bottom-1'}>Stats coming soon!</div>
