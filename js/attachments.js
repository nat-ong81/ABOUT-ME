// Photos and documents. The bytes go to the file store; only a small
// metadata row ({ id, name, type, size, ... }) goes into the database.
// Records, products and so on refer to files by id through `fileIds`.

import { db, files } from './storage/index.js';
import { uid } from './util.js';

const MAX_EDGE = 2000;     // long edge of the stored photo
const THUMB_EDGE = 480;    // long edge of the list thumbnail
const KEEP_ORIGINAL_UNDER = 1.2 * 1024 * 1024;

let metaCache = null;
const urls = new Map();

async function metas() {
  if (!metaCache) metaCache = new Map((await db.all('files')).map((m) => [m.id, m]));
  return metaCache;
}
export async function fileMeta(id) { return (await metas()).get(id) || null; }
export function resetFileCache() { metaCache = null; releaseUrls(); }

const looksLikeImage = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name || '');

export async function addFile(file) {
  const id = uid();
  let meta = {
    id,
    name: file.name || 'Untitled',
    type: file.type || 'application/octet-stream',
    size: file.size,
    kind: looksLikeImage(file) ? 'image' : 'document',
    thumb: false,
    createdAt: Date.now(),
  };

  if (meta.kind === 'image') {
    const out = await prepareImage(file).catch(() => null);
    if (out) {
      await files.put(id, out.full);
      await files.put(id + '.thumb', out.thumb);
      meta = { ...meta, type: out.full.type || meta.type, size: out.full.size, width: out.width, height: out.height, thumb: true };
    } else {
      await files.put(id, file); // could not be decoded here; keep the original
    }
  } else {
    await files.put(id, file);
  }

  await db.put('files', meta);
  (await metas()).set(id, meta);
  return meta;
}

export async function removeFile(id) {
  if (!id) return;
  await files.remove(id);
  await files.remove(id + '.thumb');
  await db.remove('files', id);
  (await metas()).delete(id);
}
export async function removeFiles(ids = []) { for (const id of ids) await removeFile(id); }

// Object URL for display. URLs are released on every page change.
export function urlFor(id, { thumb = false } = {}) {
  const cacheKey = id + (thumb ? ':t' : '');
  if (!urls.has(cacheKey)) {
    urls.set(cacheKey, (async () => {
      const meta = await fileMeta(id);
      if (!meta) return null;
      const useThumb = thumb && meta.thumb;
      const blob = await files.get(useThumb ? id + '.thumb' : id);
      if (!blob) return null;
      const type = useThumb ? 'image/jpeg' : meta.type;
      return URL.createObjectURL(blob.type === type ? blob : new Blob([blob], { type }));
    })());
  }
  return urls.get(cacheKey);
}

export function releaseUrls() {
  for (const p of urls.values()) p.then((u) => u && URL.revokeObjectURL(u)).catch(() => {});
  urls.clear();
}

export async function blobFor(key) { return files.get(key); }

// ---- image preparation -----------------------------------------------------

async function decode(file) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(source, w, h, edge, quality) {
  const scale = Math.min(1, edge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // flatten transparency
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, cw, ch);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve({ blob: b, width: cw, height: ch }) : reject(new Error('encode failed'))), 'image/jpeg', quality);
  });
}

async function prepareImage(file) {
  const source = await decode(file);
  const w = source.width || source.naturalWidth, h = source.height || source.naturalHeight;
  if (!w || !h) throw new Error('empty image');
  const thumb = await render(source, w, h, THUMB_EDGE, 0.8);
  const smallEnough = Math.max(w, h) <= MAX_EDGE && file.size <= KEEP_ORIGINAL_UNDER && /^image\/(jpeg|png|webp)$/.test(file.type);
  const full = smallEnough ? { blob: file, width: w, height: h } : await render(source, w, h, MAX_EDGE, 0.86);
  source.close?.();
  return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
}
