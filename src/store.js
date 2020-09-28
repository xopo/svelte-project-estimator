import { onDestroy } from 'svelte';
import { writable } from 'svelte/store';

const newItem = writable({id: undefined, name: '', price: undefined});

const localStorageKey = 'materials';

const materials = writable(JSON.parse(localStorage.getItem(localStorageKey) || '[]'));

const add = (name, price) => {
    materials.update((items) => [...items, {name, price, id: items.length + 1}])
}

materials.subscribe(items => {
    const jsonData = JSON.stringify(items);
    localStorage.setItem(localStorageKey, jsonData);
})


export default {
    add,
    subscribe: materials.subscribe
}