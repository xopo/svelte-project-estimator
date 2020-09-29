<script>
    import { onDestroy } from 'svelte';
	import materials from './store';
	
	let items = [];
    
    const unsubscribe = materials.subscribe(itms => {
		items = [...itms];
    })

    $: total = items.reduce((total, item) => total += parseFloat(item.price), 0);
    
    onDestroy(() => unsubscribe);

    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    })

</script>
<style>
    table {
        width: 100%;
    }
    tfoot {
        font-weight: bold;
    }
    tbody tr {
        cursor: pointer;
    }
    tbody tr:hover {
        background:  #eee;
        color: green;
    }
    tbody tr:active {
        background: gray;
    }
    td:last-child:hover i {
        color: red;
    }
</style>
<table class='primary'>
    <thead>
        <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Price</th>
            <th></th>
        </tr>
    </thead>
    <tbody>
        {#each items as {id, name, price}, i (id)}
            <tr on:click|once|preventDefault={materials.setEditItem(id)}>
                <td>{i+1}</td>
                <td>{name}</td>
                <td class='price'>{formatter.format(price.toFixed(2))}</td>
                <td class='center' on:click|once|preventDefault={()=>materials.remove(id)}>
                    <i class="far fa-trash-alt"></i>
                </td>
            </tr>
        {/each}
    </tbody>
    <tfoot>
        {#if total > 0}
            <tr>
                <td colspan="2">Total</td>
                <td>{formatter.format(total)}</td>
            </tr>
        {/if}
    </tfoot>
</table>
