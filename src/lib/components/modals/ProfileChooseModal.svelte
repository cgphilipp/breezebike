<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
	import { profileChooseModal, currentRoutingProfile } from '$lib/navigationState.svelte';
</script>

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
