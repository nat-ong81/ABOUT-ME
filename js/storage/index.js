// The one place where storage back-ends are chosen.
//
//   db     structured data          IndexedDB            -> SQLite / JSON file
//   files  photos and documents     OPFS (Cache Storage) -> Capacitor Filesystem
//   prefs  lightweight settings     localStorage         -> Capacitor Preferences
//
// The rest of the app imports only `db`, `files` and `prefs` from here, so a
// native build swaps the three constructors below and nothing else.

import { IndexedDbStore, STORES } from './db.js';
import { createFileStore } from './files.js';
import { LocalPrefs } from './prefs.js';

export { STORES };
export const db = new IndexedDbStore();
export const prefs = new LocalPrefs();
export let files = null;

export async function initStorage() {
  await db.open();
  files = await createFileStore();
  return { db, files, prefs };
}

// Ask the browser not to evict this origin's data under storage pressure.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

export async function storageReport() {
  let persisted = false, usage = null;
  try { persisted = !!(await navigator.storage?.persisted?.()); } catch { /* ignore */ }
  try { usage = (await navigator.storage?.estimate?.())?.usage ?? null; } catch { /* ignore */ }
  return { persisted, usage, data: db.label, files: files?.label, filesDurable: !!files?.durable };
}

export async function eraseEverything() {
  for (const s of STORES) await db.clear(s);
  await files.clear();
  prefs.clear();
}
