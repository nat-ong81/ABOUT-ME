// 2 / 3 — FILES (photos and documents)
// Blobs are kept outside the structured database, addressed by a plain key.
//
//   OpfsFileStore   the browser's private file system (preferred)
//   CacheFileStore  Cache Storage, for browsers without a writable OPFS
//   MemoryFileStore last resort; lasts only until the page is closed
//
// A native build replaces these with one class backed by the Capacitor
// Filesystem plugin. The interface is: put, get, remove, keys, clear.

export class OpfsFileStore {
  constructor(dir) {
    this.dir = dir;
    this.kind = 'opfs';
    this.label = 'Private file storage on this device';
    this.durable = true;
    this._worker = null;
    this._seq = 0;
    this._pending = new Map();
  }

  static async create() {
    if (!navigator.storage?.getDirectory) return null;
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('files', { create: true });
      const store = new OpfsFileStore(dir);
      // Probe: some browsers expose OPFS but cannot write from this context.
      await store.put('.probe', new Blob(['ok']));
      await store.remove('.probe');
      return store;
    } catch {
      return null;
    }
  }

  async put(key, blob) {
    const handle = await this.dir.getFileHandle(key, { create: true });
    if (typeof handle.createWritable === 'function') {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    }
    // Older Safari: writing is only possible from a worker.
    await this._viaWorker(key, await blob.arrayBuffer());
  }

  _viaWorker(key, buffer) {
    if (!this._worker) {
      this._worker = new Worker(new URL('./opfs-worker.js', import.meta.url));
      this._worker.onmessage = ({ data }) => {
        const p = this._pending.get(data.id);
        if (!p) return;
        this._pending.delete(data.id);
        data.ok ? p.resolve() : p.reject(new Error(data.error || 'The file could not be written.'));
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++this._seq;
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({ id, key, buffer }, [buffer]);
    });
  }

  async get(key) {
    try {
      const handle = await this.dir.getFileHandle(key);
      return await handle.getFile();
    } catch { return null; }
  }

  async remove(key) {
    try { await this.dir.removeEntry(key); } catch { /* already gone */ }
  }

  async keys() {
    const out = [];
    for await (const name of this.dir.keys()) out.push(name);
    return out;
  }

  async clear() {
    for (const key of await this.keys()) await this.remove(key);
  }
}

export class CacheFileStore {
  constructor() {
    this.kind = 'cache';
    this.label = 'Browser file cache on this device';
    this.durable = true;
    this.cacheName = 'iom-files-v1'; // never touched by the service worker
    this.base = new URL('./__files__/', location.href.split('#')[0]).href;
  }

  static async create() {
    if (!globalThis.caches || !/^https?:$/.test(location.protocol)) return null;
    try {
      const store = new CacheFileStore();
      await store.put('.probe', new Blob(['ok']));
      await store.remove('.probe');
      return store;
    } catch { return null; }
  }

  _url(key) { return this.base + encodeURIComponent(key); }

  async put(key, blob) {
    const cache = await caches.open(this.cacheName);
    await cache.put(this._url(key), new Response(blob, {
      headers: { 'Content-Type': blob.type || 'application/octet-stream', 'Content-Length': String(blob.size) },
    }));
  }
  async get(key) {
    const cache = await caches.open(this.cacheName);
    const res = await cache.match(this._url(key));
    return res ? res.blob() : null;
  }
  async remove(key) {
    const cache = await caches.open(this.cacheName);
    await cache.delete(this._url(key));
  }
  async keys() {
    const cache = await caches.open(this.cacheName);
    return (await cache.keys()).map((r) => decodeURIComponent(r.url.slice(this.base.length)));
  }
  async clear() { await caches.delete(this.cacheName); }
}

export class MemoryFileStore {
  constructor() {
    this.kind = 'memory';
    this.label = 'Temporary memory (photos will not be kept)';
    this.durable = false;
    this.map = new Map();
  }
  async put(key, blob) { this.map.set(key, blob); }
  async get(key) { return this.map.get(key) || null; }
  async remove(key) { this.map.delete(key); }
  async keys() { return [...this.map.keys()]; }
  async clear() { this.map.clear(); }
}

export async function createFileStore() {
  return (await OpfsFileStore.create()) || (await CacheFileStore.create()) || new MemoryFileStore();
}
