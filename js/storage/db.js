// 1 / 3 — STRUCTURED DATA
// Small JSON documents only: records, reference entries, products, inventory
// and the metadata describing uploaded files. No image bytes ever go in here.
//
// Any replacement (for example SQLite through Capacitor) only has to provide
// the same async methods: all, get, put, putMany, remove, clear.

export const STORES = ['records', 'me', 'groups', 'products', 'inventory', 'files'];

export class IndexedDbStore {
  constructor(name = 'index-of-me', version = 1) {
    this.name = name;
    this.version = version;
    this.kind = 'indexeddb';
    this.label = 'IndexedDB';
    this._open = null;
  }

  open() {
    if (!this._open) {
      this._open = new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) return reject(new Error('IndexedDB is not available in this browser.'));
        const req = indexedDB.open(this.name, this.version);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const s of STORES) {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => req.result.close();
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('The database is open in another tab.'));
      });
    }
    return this._open;
  }

  async _run(store, mode, work) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      let result;
      const req = work(tx.objectStore(store));
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('The change could not be saved.'));
    });
  }

  all(store) { return this._run(store, 'readonly', (o) => o.getAll()); }
  get(store, id) { return this._run(store, 'readonly', (o) => o.get(id)); }
  async put(store, value) { await this._run(store, 'readwrite', (o) => { o.put(value); }); return value; }
  putMany(store, values) { return this._run(store, 'readwrite', (o) => { for (const v of values) o.put(v); }); }
  remove(store, id) { return this._run(store, 'readwrite', (o) => { o.delete(id); }); }
  clear(store) { return this._run(store, 'readwrite', (o) => { o.clear(); }); }
}
