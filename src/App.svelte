<script>
	import Table from './Table.svelte';
	import Form from './Form.svelte';

	import { newItem } from './store';
</script>
<style>
	main {
		flex: 1;
		align-content: center;
		justify-content: center;
		width: 80%;
		margin: 0 auto;
	}
</style>
<svelte:head>
	<title>Project Estimator</title>
</svelte:head>

<main>
	<h1>Project estimator</h1>
	<Form {newItem}/>
	<Table />
</main>