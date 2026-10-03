// Shared interface pieces: page layout, form fields, photos, dialogs.

import { h, add } from './dom.js';
import { addFile, removeFile, urlFor, fileMeta, blobFor } from '../attachments.js';
import { fmtBytes } from '../util.js';

let seq = 0;

// ---- page layout -------------------------------------------------------------

// Two-part page: a lead (numeral, title, actions) and the body.
// Stacked on a phone, side by side on a wide screen.
export function spread(lead, body, { wide = false } = {}) {
  const { no, kicker, title, lede, actions, extra } = lead;
  return h('article', { class: 'spread' + (wide ? ' spread--wide' : '') },
    h('header', { class: 'spread__lead' },
      no && h('p', { class: 'numeral', 'aria-hidden': 'true' }, no),
      kicker && h('p', { class: 'label lead__kicker' }, kicker),
      h('h1', { class: 'title' }, title),
      lede && h('p', { class: 'lede' }, lede),
      actions?.length ? h('div', { class: 'lead__actions' }, actions) : null,
      extra,
    ),
    h('div', { class: 'spread__body' }, body),
  );
}

export function act(label, target, { quiet = false } = {}) {
  const cls = 'act' + (quiet ? ' act--quiet' : '');
  return typeof target === 'string'
    ? h('a', { class: cls, href: target }, label)
    : h('button', { class: cls, type: 'button', onclick: target }, label);
}

export function button(label, { solid = false, type = 'button', onclick, disabled } = {}) {
  return h('button', { class: 'btn' + (solid ? ' btn--solid' : ''), type, onclick, disabled }, label);
}

export function filters(items, active, { label = 'Filter' } = {}) {
  return h('nav', { class: 'filters', 'aria-label': label },
    items.map((i) => h('a', { class: 'filters__item', href: i.href, 'aria-current': i.id === active ? 'true' : null },
      i.name, i.count != null && h('span', { class: 'filters__count' }, String(i.count)))));
}

export function empty(text, action) {
  return h('div', { class: 'empty' }, h('p', { class: 'empty__text' }, text), action);
}

export function sectionLabel(text, ...right) {
  return h('div', { class: 'section-label' }, h('h2', { class: 'label' }, text), right);
}

// Label / value pairs for detail pages. Empty values are left out.
export function defs(pairs) {
  const rows = pairs.filter(([, v]) => v != null && v !== '' && v !== false);
  if (!rows.length) return null;
  return h('dl', { class: 'defs' }, rows.map(([k, v, cls]) => h('div', { class: 'defs__row' },
    h('dt', { class: 'label' }, k), h('dd', { class: cls || null }, v))));
}

// ---- forms -------------------------------------------------------------------

export function field(label, control, { hint, wide = false } = {}) {
  if (!control.id) control.id = 'f' + (++seq);
  const wrapped = control.tagName === 'SELECT' ? h('div', { class: 'select' }, control) : control;
  return h('div', { class: 'field' + (wide ? ' field--wide' : '') },
    h('label', { class: 'label', for: control.id }, label), wrapped,
    hint && h('p', { class: 'hint' }, hint));
}

export const input = (props = {}) => h('input', { class: 'input', type: 'text', autocomplete: 'off', ...props });

export function textarea(props = {}) {
  const el = h('textarea', { class: 'input input--area', rows: 3, ...props });
  const grow = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; };
  el.addEventListener('input', grow);
  requestAnimationFrame(grow);
  return el;
}

export function select(options, value, props = {}) {
  const el = h('select', { class: 'input', ...props }, options.map((o) => h('option', { value: o.id }, o.name)));
  el.value = value ?? options[0]?.id;
  return el;
}

export function formActions({ submit = 'Save', cancelHref, onDelete, deleteLabel = 'Delete' }) {
  return h('div', { class: 'form__actions' },
    button(submit, { solid: true, type: 'submit' }),
    cancelHref && h('a', { class: 'btn', href: cancelHref }, 'Cancel'),
    onDelete && h('button', { class: 'act act--quiet form__delete', type: 'button', onclick: onDelete }, deleteLabel));
}

export function formError(form, message) {
  let el = form.querySelector('.form__error');
  if (!el) { el = h('p', { class: 'form__error', role: 'alert' }); form.querySelector('.form__actions')?.before(el); }
  el.textContent = message;
}

// ---- photos and documents ----------------------------------------------------

export function picture(fileId, { thumb = false, alt = '', cls = '', placeholder = '' } = {}) {
  const box = h('span', { class: 'pic ' + cls });
  const blank = () => {
    box.classList.add('pic--empty');
    if (placeholder) box.append(h('span', { class: 'pic__ph' }, placeholder));
  };
  if (!fileId) { blank(); return box; }
  fileMeta(fileId).then((meta) => {
    if (!meta) return blank();
    if (meta.kind !== 'image') { box.classList.add('pic--empty'); box.append(h('span', { class: 'pic__ph' }, 'Document')); return; }
    return urlFor(fileId, { thumb }).then((url) => {
      if (!url) return blank();
      const img = h('img', { alt, decoding: 'async' });
      img.onerror = () => { img.remove(); blank(); };
      img.src = url;
      box.append(img);
    });
  }).catch(blank);
  return box;
}

function lightbox(fileId, alt) {
  const d = h('dialog', { class: 'lightbox', 'aria-label': alt || 'Photo' });
  const close = h('button', { class: 'act lightbox__close', type: 'button', onclick: () => d.close() }, 'Close');
  d.append(close, picture(fileId, { alt, cls: 'lightbox__pic' }));
  d.addEventListener('click', (e) => { if (e.target === d || e.target.tagName === 'IMG') d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
}

async function openDocument(meta) {
  const blob = await blobFor(meta.id);
  if (!blob) return toast('That file is no longer on this device.');
  const file = new File([blob], meta.name, { type: meta.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* closed */ }
    return;
  }
  const url = URL.createObjectURL(file);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Photos and documents shown on a detail page.
export function gallery(fileIds = [], { alt = '' } = {}) {
  if (!fileIds.length) return null;
  const node = h('div', { class: 'gallery' });
  for (const id of fileIds) {
    const slot = h('div', { class: 'gallery__slot' });
    node.append(slot);
    fileMeta(id).then((meta) => {
      if (!meta) { slot.remove(); return; }
      if (meta.kind === 'image') {
        slot.append(h('button', { class: 'gallery__item', type: 'button', 'aria-label': 'View photo', onclick: () => lightbox(id, alt || meta.name) },
          picture(id, { alt: alt || meta.name })));
      } else {
        slot.append(h('button', { class: 'doc', type: 'button', onclick: () => openDocument(meta) },
          h('span', { class: 'label' }, 'Document'),
          h('span', { class: 'doc__name' }, meta.name),
          h('span', { class: 'doc__size' }, fmtBytes(meta.size))));
      }
    });
  }
  return node;
}

// Upload control. Files are written as soon as they are chosen; `commit`
// finalises removals after a save, `discard` undoes additions on cancel.
export function photoField({ ids = [], multiple = true, documents = true, addLabel } = {}) {
  let current = [...ids];
  const added = [], removed = [];
  const list = h('ul', { class: 'photos__list' });
  const status = h('p', { class: 'hint photos__status', 'aria-live': 'polite' });
  const fileInput = h('input', {
    class: 'visually-hidden', type: 'file',
    accept: documents ? 'image/*,application/pdf' : 'image/*',
    multiple,
  });
  const label = addLabel || (documents ? 'Add photo or document' : 'Add photo');
  const addText = h('span', { class: 'act' }, label);
  const adder = h('label', { class: 'photos__add' }, fileInput, addText);

  function draw() {
    list.replaceChildren(...current.map((id) => h('li', { class: 'photos__item' },
      picture(id, { thumb: true, cls: 'photos__pic' }),
      h('button', { class: 'act act--quiet photos__remove', type: 'button', onclick: () => {
        current = current.filter((x) => x !== id);
        removed.push(id);
        draw();
      } }, 'Remove'))));
    list.hidden = !current.length;
    addText.textContent = !multiple && current.length ? 'Replace photo' : label;
  }

  fileInput.addEventListener('change', async () => {
    const chosen = [...fileInput.files];
    fileInput.value = '';
    if (!chosen.length) return;
    status.textContent = chosen.length === 1 ? 'Adding…' : `Adding ${chosen.length} files…`;
    try {
      for (const f of chosen) {
        const meta = await addFile(f);
        added.push(meta.id);
        if (!multiple) { removed.push(...current); current = []; }
        current.push(meta.id);
        draw();
      }
      status.textContent = '';
    } catch (err) {
      console.error(err);
      status.textContent = 'That file could not be saved on this device.';
    }
  });

  draw();
  return {
    node: h('div', { class: 'photos' }, list, adder, status),
    value: () => [...current],
    async commit() { for (const id of removed) await removeFile(id); removed.length = 0; added.length = 0; },
    async discard() { for (const id of added) await removeFile(id); added.length = 0; },
  };
}

// ---- dialogs -----------------------------------------------------------------

export function confirmDialog({ title, body, confirm = 'Delete', cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    const d = h('dialog', { class: 'dialog' });
    add(d, [
      h('h2', { class: 'dialog__title' }, title),
      body && h('p', { class: 'dialog__body' }, body),
      h('div', { class: 'dialog__actions' },
        button(cancel, { onclick: () => d.close('no') }),
        button(confirm, { solid: true, onclick: () => d.close('yes') })),
    ]);
    d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
    document.body.append(d);
    if (d.showModal) d.showModal(); else { d.remove(); resolve(window.confirm(title)); }
  });
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}
