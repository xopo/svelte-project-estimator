import { writable } from 'svelte/store';

export const newItem = writable({id: undefined, name: '', price: undefined});
