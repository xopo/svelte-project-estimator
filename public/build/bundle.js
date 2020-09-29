var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const uniqueId = id => `_${id}` + Math.random().toString(36).substr(2, 9);

    const localStorageKey = 'materials';

    const materials = writable(JSON.parse(localStorage.getItem(localStorageKey) || '[]'));

    const add = (name, price) => {
        materials.update(items => [...items, {
            name, 
            price, 
            id: uniqueId(items.length + 1),
            edit: false
        }]);
    };

    const update$1 = (name, price, id) => {
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
    };

    const remove = id => {
        materials.update(items => items.filter(item => item.id !== id));
    };

    const setEditItem = id => {
        console.log('set edit item', id);
        materials.update(items => items.map(item => {
            item.edit = item.id === id;
            return item;
        }));
    };

    // set local storage
    materials.subscribe(items => {
        const jsonData = JSON.stringify(items);
        localStorage.setItem(localStorageKey, jsonData);
    });


    var materials$1 = {
        update: update$1,
        remove,
        setEditItem,
        subscribe: materials.subscribe
    };

    /* src/Table.svelte generated by Svelte v3.28.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i].id;
    	child_ctx[6] = list[i].name;
    	child_ctx[7] = list[i].price;
    	child_ctx[9] = i;
    	return child_ctx;
    }

    // (52:8) {#each items as {id, name, price}
    function create_each_block(key_1, ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*i*/ ctx[9] + 1 + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*name*/ ctx[6] + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*formatter*/ ctx[2].format(/*price*/ ctx[7].toFixed(2)) + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[3](/*id*/ ctx[5], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			td3.innerHTML = `<i class="far fa-trash-alt svelte-1btvk9n"></i>`;
    			t6 = space();
    			attr(td2, "class", "price");
    			attr(td3, "class", "center svelte-1btvk9n");
    			attr(tr, "class", "svelte-1btvk9n");
    			this.first = tr;
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, t4);
    			append(tr, t5);
    			append(tr, td3);
    			append(tr, t6);

    			if (!mounted) {
    				dispose = [
    					listen(td3, "click", prevent_default(click_handler), { once: true }),
    					listen(
    						tr,
    						"click",
    						prevent_default(function () {
    							if (is_function(materials$1.setEditItem(/*id*/ ctx[5]))) materials$1.setEditItem(/*id*/ ctx[5]).apply(this, arguments);
    						}),
    						{ once: true }
    					)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*items*/ 1 && t0_value !== (t0_value = /*i*/ ctx[9] + 1 + "")) set_data(t0, t0_value);
    			if (dirty & /*items*/ 1 && t2_value !== (t2_value = /*name*/ ctx[6] + "")) set_data(t2, t2_value);
    			if (dirty & /*items*/ 1 && t4_value !== (t4_value = /*formatter*/ ctx[2].format(/*price*/ ctx[7].toFixed(2)) + "")) set_data(t4, t4_value);
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (64:8) {#if total > 0}
    function create_if_block(ctx) {
    	let tr;
    	let td0;
    	let t1;
    	let td1;
    	let t2_value = /*formatter*/ ctx[2].format(/*total*/ ctx[1]) + "";
    	let t2;

    	return {
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			td0.textContent = "Total";
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			attr(td0, "colspan", "2");
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*total*/ 2 && t2_value !== (t2_value = /*formatter*/ ctx[2].format(/*total*/ ctx[1]) + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let table;
    	let thead;
    	let t6;
    	let tbody;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t7;
    	let tfoot;
    	let each_value = /*items*/ ctx[0];
    	const get_key = ctx => /*id*/ ctx[5];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let if_block = /*total*/ ctx[1] > 0 && create_if_block(ctx);

    	return {
    		c() {
    			table = element("table");
    			thead = element("thead");

    			thead.innerHTML = `<tr><th>Id</th> 
            <th>Name</th> 
            <th>Price</th> 
            <th></th></tr>`;

    			t6 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			tfoot = element("tfoot");
    			if (if_block) if_block.c();
    			attr(tbody, "class", "svelte-1btvk9n");
    			attr(tfoot, "class", "svelte-1btvk9n");
    			attr(table, "class", "primary svelte-1btvk9n");
    		},
    		m(target, anchor) {
    			insert(target, table, anchor);
    			append(table, thead);
    			append(table, t6);
    			append(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append(table, t7);
    			append(table, tfoot);
    			if (if_block) if_block.m(tfoot, null);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*materials, items, formatter*/ 5) {
    				const each_value = /*items*/ ctx[0];
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, tbody, destroy_block, create_each_block, null, get_each_context);
    			}

    			if (/*total*/ ctx[1] > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(tfoot, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let items = [];

    	const unsubscribe = materials$1.subscribe(itms => {
    		$$invalidate(0, items = [...itms]);
    	});

    	onDestroy(() => unsubscribe);
    	const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    	const click_handler = id => materials$1.remove(id);
    	let total;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*items, total*/ 3) {
    			 $$invalidate(1, total = items.reduce((total, item) => total += parseFloat(item.price), 0));
    		}
    	};

    	return [items, total, formatter, click_handler];
    }

    class Table extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    /* src/Form.svelte generated by Svelte v3.28.0 */

    function create_if_block$1(ctx) {
    	let button;
    	let t;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text("Cancel");
    			attr(button, "type", "button");
    			button.disabled = button_disabled_value = /*name*/ ctx[0] === "" || /*price*/ ctx[1] === undefined;
    			attr(button, "class", "float-left svelte-1q4q644");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", /*reset*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name, price*/ 3 && button_disabled_value !== (button_disabled_value = /*name*/ ctx[0] === "" || /*price*/ ctx[1] === undefined)) {
    				button.disabled = button_disabled_value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let form;
    	let fieldset0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let fieldset1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let t6;
    	let fieldset2;
    	let button;
    	let t7;
    	let button_disabled_value;
    	let mounted;
    	let dispose;
    	let if_block = /*mode*/ ctx[2] === "Edit" && create_if_block$1(ctx);

    	return {
    		c() {
    			form = element("form");
    			fieldset0 = element("fieldset");
    			label0 = element("label");
    			label0.textContent = "Material";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			fieldset1 = element("fieldset");
    			label1 = element("label");
    			label1.textContent = "Price";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			if (if_block) if_block.c();
    			t6 = space();
    			fieldset2 = element("fieldset");
    			button = element("button");
    			t7 = text(/*mode*/ ctx[2]);
    			attr(label0, "for", "material");
    			attr(input0, "type", "text");
    			attr(input0, "name", "material");
    			attr(input0, "id", "material");
    			attr(input0, "placeholder", "Wood, Glue, etc.. ");
    			attr(label1, "for", "price");
    			attr(input1, "type", "number");
    			attr(input1, "min", "0");
    			attr(input1, "step", "any");
    			attr(input1, "name", "price");
    			attr(input1, "id", "price");
    			attr(input1, "placeholder", "price");
    			attr(button, "type", "submit");
    			attr(button, "class", "float-right svelte-1q4q644");
    			button.disabled = button_disabled_value = !/*name*/ ctx[0] || !/*name*/ ctx[0].trim().length || !/*price*/ ctx[1];
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);
    			append(form, fieldset0);
    			append(fieldset0, label0);
    			append(fieldset0, t1);
    			append(fieldset0, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append(form, t2);
    			append(form, fieldset1);
    			append(fieldset1, label1);
    			append(fieldset1, t4);
    			append(fieldset1, input1);
    			set_input_value(input1, /*price*/ ctx[1]);
    			append(form, t5);
    			if (if_block) if_block.m(form, null);
    			append(form, t6);
    			append(form, fieldset2);
    			append(fieldset2, button);
    			append(button, t7);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen(form, "submit", /*submit*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*price*/ 2 && to_number(input1.value) !== /*price*/ ctx[1]) {
    				set_input_value(input1, /*price*/ ctx[1]);
    			}

    			if (/*mode*/ ctx[2] === "Edit") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(form, t6);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*mode*/ 4) set_data(t7, /*mode*/ ctx[2]);

    			if (dirty & /*name, price*/ 3 && button_disabled_value !== (button_disabled_value = !/*name*/ ctx[0] || !/*name*/ ctx[0].trim().length || !/*price*/ ctx[1])) {
    				button.disabled = button_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { id } = $$props;
    	let { name } = $$props;
    	let { price } = $$props;

    	const submit = () => {
    		materials$1.update(name, price, id);
    		reset();
    	};

    	const reset = () => {
    		$$invalidate(5, id = undefined);
    		$$invalidate(0, name = "");
    		$$invalidate(1, price = undefined);
    	};

    	//     let items = [];
    	const unsubscribe = materials$1.subscribe(items => {
    		const editItem = items.find(i => i.edit === true);

    		if (editItem) {
    			$$invalidate(5, { id, name, price } = editItem, id, $$invalidate(0, name), $$invalidate(1, price));
    		}
    	});

    	onDestroy(() => unsubscribe);

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_input_handler() {
    		price = to_number(this.value);
    		$$invalidate(1, price);
    	}

    	$$self.$$set = $$props => {
    		if ("id" in $$props) $$invalidate(5, id = $$props.id);
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("price" in $$props) $$invalidate(1, price = $$props.price);
    	};

    	let mode;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*id*/ 32) {
    			 $$invalidate(2, mode = id ? "Edit" : "Add");
    		}
    	};

    	return [
    		name,
    		price,
    		mode,
    		submit,
    		reset,
    		id,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Form extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 5, name: 0, price: 1 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.28.0 */

    function create_fragment$2(ctx) {
    	let t0;
    	let main;
    	let h1;
    	let t2;
    	let form;
    	let t3;
    	let table;
    	let current;
    	form = new Form({});
    	table = new Table({});

    	return {
    		c() {
    			t0 = space();
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Project estimator";
    			t2 = space();
    			create_component(form.$$.fragment);
    			t3 = space();
    			create_component(table.$$.fragment);
    			document.title = "Project Estimator";
    			attr(main, "class", "svelte-1d4e8fi");
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, main, anchor);
    			append(main, h1);
    			append(main, t2);
    			mount_component(form, main, null);
    			append(main, t3);
    			mount_component(table, main, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			transition_in(table.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(form.$$.fragment, local);
    			transition_out(table.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(main);
    			destroy_component(form);
    			destroy_component(table);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
