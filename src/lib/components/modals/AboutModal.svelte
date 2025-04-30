<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { aboutModal } from '$lib/navigationState.svelte';
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
