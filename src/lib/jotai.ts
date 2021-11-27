import { writable } from 'svelte/store';

export const atom = writable;

function persistedWritable(initialValue, { key }) {
  const atom = writable(initialValue);

  let initialized = false;
  atom.subscribe((val) => {
    const localVal = JSON.parse(localStorage.getItem(key));

    if (localVal !== null && !initialized) {
      atom.set(localVal);
      val = localVal;
      initialized = true;
    }

    localStorage.setItem(key, val + '');
  });

  return atom;
}
