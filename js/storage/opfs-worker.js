// Writes a file into the origin private file system for browsers that only
// allow OPFS writes from a worker (Safari before version 26).
self.onmessage = async ({ data }) => {
  const { id, key, buffer } = data;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('files', { create: true });
    const handle = await dir.getFileHandle(key, { create: true });
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(new Uint8Array(buffer), { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
    self.postMessage({ id, ok: true });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
