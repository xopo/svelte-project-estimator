import { onDestroy } from 'svelte';
import { writable } from 'svelte/store';

const uniqueId = id => `_${id}` + Math.random().toString(36).substr(2, 9);

const localStorageKey = 'materials';

const materials = writable(JSON.parse(localStorage.getItem(localStorageKey) || '[]'));

const add = (name, price) => {
    materials.update(items => [...items, {
        name, 
        price, 
        id: uniqueId(items.length + 1),
        edit: false
    }])
}

const update = (name, price, id) => {
    if (!id) {
        add(name, price);
        return;
    }

    materials.update(items => {
        const itemIndex = items.findIndex(el => el.id === id);
        
        items[itemIndex].name = name;
        items[itemIndex].price = price;
        items[itemIndex].edit = false;
        
        return items;
    });
}

const remove = id => {
    materials.update(items => items.filter(item => item.id !== id))
}

const setEditItem = id => {
    console.log('set edit item', id);
    materials.update(items => items.map(item => {
        item.edit = item.id === id;
        return item;
    }))
}

// set local storage
materials.subscribe(items => {
    const jsonData = JSON.stringify(items);
    localStorage.setItem(localStorageKey, jsonData);
})


export default {
    update,
    remove,
    setEditItem,
    subscribe: materials.subscribe
}