<script>
    export let id;
    export let name;
    export let price;

    $: mode = id ? 'Edit' : 'Add';
     
    const submit = () => {
        reset();
    }

    const reset = () => {
        id = undefined;
        name = '';
        price = undefined;
    }
</script>
<h1>{mode} - {price} - {name}</h1>
<form on:submit|preventDefault={submit}>
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
    <button 
        type="submit"  
        class='float-right'
        disabled={!name.trim().length || !price}
    >
        {mode}
    </button>
</form>

<style>
    button:disabled {
        cursor: not-allowed;
    }
</style>