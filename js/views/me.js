import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { RX_EYES, RX_COLUMNS } from '../config.js';
import { navigate } from '../router.js';
import { removeFiles } from '../attachments.js';
import {
  spread, act, defs, field, input, textarea, formActions, formError,
  photoField, gallery, confirmDialog, toast, sectionLabel, pager,
} from '../ui/components.js';
import { allGroups, meTitle, meSummary } from '../domain/model.js';
import { uid, fmtDate, fmtShort, byText, todayISO } from '../util.js';

const HOME = { label: 'Home', href: '#/' };
const ME = { label: 'Profile', href: '#/me' };

async function loadGroups() { return allGroups(await db.all('groups')); }

function sortEntries(entries, group) {
  if (group.layout === 'rx') return entries.sort((a, b) => (b.data?.issued || '').localeCompare(a.data?.issued || '') || (b.createdAt || 0) - (a.createdAt || 0));
  return entries.sort(byText((e) => meTitle(e, group)));
}

// Sphere / cylinder / axis for each eye, as it is written on a prescription.
function rxTable(data = {}) {
  return h('table', { class: 'rx' },
    h('thead', null, h('tr', null, h('th', null), RX_COLUMNS.map((c) => h('th', { class: 'label', scope: 'col' }, c.name)))),
    h('tbody', null, RX_EYES.map((eye) => h('tr', null,
      h('th', { class: 'label', scope: 'row', title: eye.hint }, eye.name),
      RX_COLUMNS.map((c) => h('td', null, data[eye.id + c.id] || '–'))))));
}

// ---- the reference sheet -----------------------------------------------------

export async function mePage() {
  const [groups, entries] = await Promise.all([loadGroups(), db.all('me')]);
  const body = h('div', { class: 'sheet' });

  groups.forEach((g, i) => {
    const mine = sortEntries(entries.filter((e) => e.group === g.id), g);
    const section = h('section', { class: 'sheet__section' },
      sectionLabel(g.name,
        h('span', { class: 'section-label__no' }, `01.${i + 1}`),
        h('span', { class: 'section-label__actions' },
          g.custom && act('Edit section', `#/me/sections/${g.id}/edit`, { quiet: true }),
          act('Add', `#/me/${g.id}/new`))));

    if (!mine.length) {
      section.append(h('p', { class: 'sheet__empty' }, g.layout === 'rx' ? 'No prescription on file.' : 'Nothing on file.'));
    } else if (g.layout === 'rx') {
      // Newest first; older prescriptions are a swipe (or arrow) away.
      section.append(pager(mine.map((e, i) => {
        const d = e.data || {};
        return h('a', { class: 'rx-card', href: `#/me/${g.id}/${e.id}` },
          rxTable(d),
          h('span', { class: 'rx-card__meta' },
            h('span', { class: 'label' }, i === 0 ? 'Current' : 'Earlier'),
            d.issued && h('span', null, 'Issued ', fmtShort(d.issued)),
            d.pd && h('span', null, 'PD ', d.pd),
            d.optometrist && h('span', null, d.optometrist)));
      })));
    } else {
      section.append(h('ul', { class: 'lines' }, mine.map((e) => h('li', null,
        h('a', { class: 'lines__row', href: `#/me/${g.id}/${e.id}` },
          h('span', { class: 'lines__title' }, meTitle(e, g)),
          h('span', { class: 'lines__sub' }, meSummary(e, g)))))));
    }
    body.append(section);
  });

  return {
    crumbs: [HOME, { label: 'Profile' }],
    node: spread({
      no: '01', title: 'Profile',
      lede: 'The details that rarely change, in one place.',
      actions: [act('Add section +', '#/me/sections/new')],
    }, body),
  };
}

function priceTable(prices) {
  const num = (p) => { const n = parseFloat(String(p.price).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : Infinity; };
  const rows = [...prices].sort((a, b) => num(a) - num(b));
  return h('div', { class: 'prices' }, sectionLabel('Price comparison'),
    h('table', { class: 'ptable' },
      h('thead', null, h('tr', null, ['Pharmacy', 'Price', 'Surveyed'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.map((p, i) => h('tr', { class: i === 0 && rows.length > 1 ? 'is-lowest' : null },
        h('td', null, p.place || '–'), h('td', null, p.price || '–'), h('td', null, p.date ? fmtShort(p.date) : '–'))))));
}

// ---- one entry ---------------------------------------------------------------

export async function meDetail({ params }) {
  const groups = await loadGroups();
  const g = groups.find((x) => x.id === params.group);
  const e = await db.get('me', params.id);
  if (!g || !e || e.group !== g.id) return { redirect: 'me' };
  const d = e.data || {};

  async function del() {
    if (!(await confirmDialog({ title: 'Delete this entry?', body: 'This cannot be undone.' }))) return;
    await removeFiles(e.fileIds);
    await db.remove('me', e.id);
    toast('Entry deleted');
    navigate('me', { replace: true });
  }

  let content;
  if (g.layout === 'rx') {
    content = [rxTable(d), defs([
      ['PD', d.pd], ['Date issued', fmtDate(d.issued)], ['Optometrist', d.optometrist], ['Notes', d.notes, 'prose'],
    ])];
  } else if (g.custom) {
    content = defs([...(e.pairs || []).filter((p) => p.value).map((p) => [p.label || 'Detail', p.value]), ['Notes', d.notes, 'prose']]);
  } else {
    content = defs(g.fields.filter((f) => f.key !== g.titleKey).map((f) => [f.label, f.type === 'date' ? fmtDate(d[f.key]) : d[f.key], f.type === 'textarea' ? 'prose' : null]));
  }

  const title = g.layout === 'rx' ? 'Glasses prescription' : meTitle(e, g);
  return {
    crumbs: [HOME, ME, { label: g.name, href: '#/me' }, { label: g.layout === 'rx' ? 'Prescription' : title }],
    node: spread({
      kicker: g.name, title,
      lede: g.layout === 'rx' && d.issued ? `Issued ${fmtDate(d.issued)}` : null,
      actions: [act('Edit', `#/me/${g.id}/${e.id}/edit`), act('Delete', del, { quiet: true })],
    }, h('div', null, content, g.prices && e.prices?.length ? priceTable(e.prices) : null, gallery(e.fileIds, { alt: title }))),
  };
}

// ---- add / edit an entry -----------------------------------------------------

export async function meForm({ params }) {
  const groups = await loadGroups();
  const g = groups.find((x) => x.id === params.group);
  if (!g) return { redirect: 'me' };
  const editing = params.id ? await db.get('me', params.id) : null;
  if (params.id && (!editing || editing.group !== g.id)) return { redirect: 'me' };
  const d = editing?.data || {};

  const controls = {};
  const parts = [];
  let pairsBox = null;

  if (g.layout === 'rx') {
    parts.push(h('div', { class: 'rx-form', role: 'group', 'aria-label': 'Prescription values' },
      h('span', null), RX_COLUMNS.map((c) => h('span', { class: 'label' }, c.name)),
      RX_EYES.map((eye) => [
        h('span', { class: 'rx-form__eye' }, h('span', { class: 'label' }, eye.name), h('span', { class: 'hint' }, eye.hint)),
        RX_COLUMNS.map((c) => (controls[eye.id + c.id] = input({
          value: d[eye.id + c.id] || '', placeholder: c.placeholder, autocapitalize: 'off',
          'aria-label': `${eye.name} ${c.name}`, class: 'input input--num',
        }))),
      ])));
  }

  if (g.custom) {
    controls.title = input({ value: d.title || '', placeholder: 'Ring size, blood type, passport…', maxLength: 80 });
    parts.push(field('Entry title', controls.title));
    pairsBox = h('div', { class: 'pairs' });
    const addPair = (p = {}) => {
      const row = h('div', { class: 'pairs__row' },
        input({ value: p.label || '', placeholder: 'Header', 'aria-label': 'Header', class: 'input pairs__label' }),
        input({ value: p.value || '', placeholder: 'Text', 'aria-label': 'Text', class: 'input pairs__value' }),
        h('button', { class: 'act act--quiet', type: 'button', onclick: () => row.remove() }, 'Remove'));
      pairsBox.append(row);
    };
    (editing?.pairs?.length ? editing.pairs : [{}]).forEach(addPair);
    parts.push(h('div', { class: 'field' }, h('span', { class: 'label' }, 'Fields'), pairsBox,
      h('button', { class: 'act', type: 'button', onclick: () => addPair() }, 'Add field +')));
    controls.notes = textarea({ value: d.notes || '' });
    parts.push(field('Notes', controls.notes));
  } else {
    for (const f of g.fields) {
      const props = { value: d[f.key] || '', placeholder: f.placeholder || '' };
      controls[f.key] = f.type === 'textarea' ? textarea(props) : input({ ...props, type: f.type === 'date' ? 'date' : 'text' });
      parts.push(field(f.label, controls[f.key]));
    }
  }

  let pricesBox = null;
  if (g.prices) {
    pricesBox = h('div', { class: 'pairs' });
    const addPrice = (p = {}) => {
      const row = h('div', { class: 'prices__row' },
        input({ value: p.place || '', placeholder: 'Pharmacy', 'aria-label': 'Pharmacy', class: 'input prices__place' }),
        input({ value: p.price || '', placeholder: 'Price', 'aria-label': 'Price', class: 'input prices__price' }),
        input({ type: 'date', value: p.date || '', 'aria-label': 'Date surveyed', class: 'input prices__date' }),
        h('button', { class: 'act act--quiet', type: 'button', onclick: () => row.remove() }, 'Remove'));
      pricesBox.append(row);
    };
    (editing?.prices || []).forEach(addPrice);
    parts.push(h('div', { class: 'field' }, h('span', { class: 'label' }, 'Price comparison'), pricesBox,
      h('button', { class: 'act', type: 'button', onclick: () => addPrice({ date: todayISO() }) }, 'Add price +')));
  }

  const photos = g.photos ? photoField({ ids: editing?.fileIds || [] }) : null;
  if (photos) parts.push(h('div', { class: 'field' }, h('span', { class: 'label' }, g.layout === 'rx' ? 'Prescription photo' : 'Photos and documents'), photos.node));

  let saved = false;
  const back = editing ? `#/me/${g.id}/${editing.id}` : '#/me';

  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(Object.entries(controls).map(([k, el]) => [k, el.value.trim()]));
    const pairs = pairsBox
      ? [...pairsBox.querySelectorAll('.pairs__row')].map((r) => ({ label: r.querySelector('.pairs__label').value.trim(), value: r.querySelector('.pairs__value').value.trim() })).filter((p) => p.label || p.value)
      : undefined;

    if (g.custom && !data.title) return formError(form, 'Give this entry a title.');
    const required = (g.fields || []).find((f) => f.required && !data[f.key]);
    if (required) return formError(form, `Enter the ${required.label.toLowerCase()}.`);
    if (g.layout === 'rx' && !Object.values(data).some(Boolean) && !photos.value().length) return formError(form, 'Enter the prescription values, or add a photo of it.');

    const now = Date.now();
    const entry = {
      id: editing?.id || uid(), group: g.id, data, pairs,
      prices: pricesBox ? [...pricesBox.querySelectorAll('.prices__row')].map((r) => ({
        place: r.querySelector('.prices__place').value.trim(),
        price: r.querySelector('.prices__price').value.trim(),
        date: r.querySelector('.prices__date').value,
      })).filter((p) => p.place || p.price) : undefined,
      fileIds: photos ? photos.value() : [],
      createdAt: editing?.createdAt || now, updatedAt: now,
    };
    await db.put('me', entry);
    if (photos) await photos.commit();
    saved = true;
    toast('Saved');
    navigate(g.photos ? `me/${g.id}/${entry.id}` : 'me', { replace: true });
  } }, parts, formActions({ submit: editing ? 'Save changes' : 'Save', cancelHref: back }));

  return {
    crumbs: [HOME, ME, { label: g.name, href: '#/me' }, { label: editing ? 'Edit' : 'New' }],
    node: spread({ kicker: g.name, title: editing ? `Edit ${g.item.toLowerCase()}` : `New ${g.item.toLowerCase()}` }, form),
    cleanup: () => { if (!saved && photos) photos.discard(); },
  };
}

// ---- custom sections ---------------------------------------------------------

export async function meSectionForm({ params }) {
  const editing = params.id ? await db.get('groups', params.id) : null;
  if (params.id && !editing) return { redirect: 'me' };
  const name = input({ value: editing?.name || '', placeholder: 'Sizes, documents, hair…', maxLength: 40, autocapitalize: 'words' });

  async function del() {
    const entries = (await db.all('me')).filter((e) => e.group === editing.id);
    const ok = await confirmDialog({
      title: `Delete “${editing.name}”?`,
      body: entries.length ? `Its ${entries.length === 1 ? 'entry is' : entries.length + ' entries are'} deleted with it. This cannot be undone.` : 'This cannot be undone.',
    });
    if (!ok) return;
    for (const e of entries) { await removeFiles(e.fileIds); await db.remove('me', e.id); }
    await db.remove('groups', editing.id);
    toast('Section deleted');
    navigate('me', { replace: true });
  }

  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (!name.value.trim()) return formError(form, 'Give the section a name.');
    const id = editing?.id || uid();
    await db.put('groups', { id, name: name.value.trim(), createdAt: editing?.createdAt || Date.now() });
    toast(editing ? 'Section renamed' : 'Section added. Now add its first entry.');
    // A new section opens straight onto its first entry.
    navigate(editing ? 'me' : `me/${id}/new`, { replace: true });
  } },
    field('Section name', name, { hint: 'After naming it you add entries: each has a title, your own header and text fields, notes, and photos or documents.' }),
    formActions({ submit: editing ? 'Save changes' : 'Next', cancelHref: '#/me', onDelete: editing ? del : null, deleteLabel: 'Delete section' }));

  return {
    crumbs: [HOME, ME, { label: editing ? 'Edit section' : 'New section' }],
    node: spread({ kicker: 'Profile', title: editing ? 'Edit section' : 'New section' }, form),
  };
}
