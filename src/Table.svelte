<script>
    import { onDestroy } from 'svelte';
	import materials from './store';
	
	let items = [];
	const unsubscribe = materials.subscribe(val => {
		items = [...val];
	})
    onDestroy(() => unsubscribe);
</script>
<main>
    <table>
        <thead>
            <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Price</th>
            </tr>
        </thead>
        <tbody>
            {#each items as {id, name, price}, i (id)}
                <tr>
                    <td>{id}</td>
                    <td>{name}</td>
                    <td>{price}</td>
                </tr>
            {/each}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="2">Total</td>
                <td>xxx</td>
            </tr>
        </tfoot>
    </table>
</main>