<script>
    import { onDestroy } from 'svelte';

    import materials from './store';
 
    export let id;
    export let name;
    export let price;
 
    $: mode = id ? 'Edit' : 'Add';
     
    const submit = () => {
        materials.update(name, price, id);
        reset();
    }

    const reset = () => {
        id = undefined;
        name = '';
        price = undefined;
    }

//     let items = [];

    const unsubscribe = materials.subscribe(items => {
        const editItem = items.find(i => i.edit === true);
        
        if (editItem) {
           ({ id, name, price } = editItem);
        }
    });

    onDestroy(() => unsubscribe);
</script>

<h1>{mode} - {price} - {name}</h1>
<form on:submit={submit}>
    <fieldset>
        <label for="material">Material</label>
        <input 
            type="text" 
            name="material" 
            bind:value={name}
            id="material" 
            placeholder="Wood, Glue, etc.. "
        >
    </fieldset>
    <fieldset>
        <label for="price">Price</label>
        <input 
            type="number" 
            min="0" 
            step="any" 
            name="price" 
            bind:value={price}
            id="price" 
            placeholder='price'
        >
    </fieldset>
    {#if mode === 'Edit'}
        <button 
            type="button"  
            disabled={name === '' || price === undefined}
            class='float-left'
            on:click={reset}
        >
            Cancel
        </button>
    {/if}
    <fieldset>
        <button 
            type="submit"  
            class='float-right'
            disabled={!name || !name.trim().length || !price}
        >
            {mode}
        </button>
    </fieldset>
</form>

<style>
    button:disabled {
        cursor: not-allowed;
    }
</style>