// Backup and restore.
//
// A backup is one JSON file holding all structured data. Photos and documents
// are only included when asked for; they are then added as a separate
// `blobs` section so the structured part stays small and readable.

import { APP } from '../config.js';
import { db, files, STORES } from './index.js';

export async function buildBackup({ includeFiles = false } = {}) {
  const data = {};
  for (const s of STORES) data[s] = await db.all(s);
  const backup = { app: APP.id, schema: APP.schema, exportedAt: new Date().toISOString(), data };
  if (includeFiles) {
    backup.blobs = {};
    for (const key of await files.keys()) {
      const blob = await files.get(key);
      if (blob) backup.blobs[key] = await toBase64(blob);
    }
  }
  return backup;
}

export async function restoreBackup(backup) {
  if (!backup || backup.app !== APP.id || typeof backup.data !== 'object') {
    throw new Error('This file is not an About Me backup.');
  }
  if (Number(backup.schema) > APP.schema) {
    throw new Error('This backup was made by a newer version of About Me.');
  }
  const counts = {};
  for (const s of STORES) {
    const rows = Array.isArray(backup.data[s]) ? backup.data[s].filter((r) => r && typeof r.id === 'string') : [];
    if (rows.length) await db.putMany(s, rows); // same id replaces, new id is added
    counts[s] = rows.length;
  }
  let blobs = 0;
  if (backup.blobs && typeof backup.blobs === 'object') {
    for (const [key, b64] of Object.entries(backup.blobs)) {
      if (!/^[\w.-]+$/.test(key) || typeof b64 !== 'string') continue;
      await files.put(key, fromBase64(b64));
      blobs++;
    }
  }
  return { counts, blobs };
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes]);
}

// Hands a file to the user: the share sheet on iPhone, a download elsewhere.
export async function deliver(name, text, type = 'application/json') {
  const file = new File([text], name, { type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (err) { if (err?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
