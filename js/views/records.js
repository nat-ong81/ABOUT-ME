import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { RECORD_TYPES, REPEATS, INTERVAL_UNITS } from '../config.js';
import { navigate, refresh } from '../router.js';
import { removeFiles } from '../attachments.js';
import {
  spread, act, filters, empty, defs, field, input, textarea, select, formActions, formError,
  photoField, gallery, confirmDialog, toast,
} from '../ui/components.js';
import { recordTitle, dueFrom, reminderOf, closeEarlierReminders, dueInWords } from '../domain/reminders.js';
import { uid, todayISO, parseISO, fmtDate, fmtShort, MONTHS, pad2 } from '../util.js';

const HOME = { label: 'Home', href: '#/' };
const RECORDS = { label: 'Health', href: '#/records' };

// ---- archive -----------------------------------------------------------------

export async function recordsList({ query }) {
  const records = (await db.all('records')).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const used = RECORD_TYPES.filter((t) => records.some((r) => r.type === t.id));
  const active = used.some((t) => t.id === query.type) ? query.type : 'all';
  const shown = active === 'all' ? records : records.filter((r) => r.type === active);

  const body = h('div', null);
  if (used.length > 1) {
    body.append(filters([
      { id: 'all', name: 'All', href: '#/records' },
      ...used.map((t) => ({ id: t.id, name: t.name, href: `#/records?type=${t.id}` })),
    ], active, { label: 'Record type' }));
  }

  if (!shown.length) {
    body.append(empty('Nothing filed yet. Add a visit, a test or a vaccination and it is kept here, newest first.',
      act('Add a record', '#/records/new')));
  } else {
    let year = null, list = null;
    for (const r of shown) {
      const d = parseISO(r.date);
      const y = d ? d.getFullYear() : 'Undated';
      if (y !== year) {
        year = y;
        list = h('ol', { class: 'ledger' });
        body.append(h('section', { class: 'year' }, h('h2', { class: 'year__no' }, String(y)), list));
      }
      const rem = reminderOf(r);
      list.append(h('li', null, h('a', { class: 'ledger__row', href: `#/records/${r.id}` },
        h('span', { class: 'ledger__date' },
          h('span', { class: 'ledger__day' }, d ? pad2(d.getDate()) : ''),
          h('span', { class: 'label' }, d ? MONTHS[d.getMonth()].slice(0, 3) : '')),
        h('span', { class: 'ledger__main' },
          h('span', { class: 'label' }, recordTitle(r)),
          h('span', { class: 'ledger__title' }, r.provider || recordTitle(r)),
          r.notes && h('span', { class: 'ledger__note' }, r.notes)),
        rem && rem.status !== 'done' && h('span', { class: 'ledger__meta' + (rem.status === 'overdue' ? ' is-overdue' : '') },
          h('span', { class: 'label' }, rem.status === 'overdue' ? 'Overdue' : 'Next'),
          h('span', null, fmtShort(rem.due))))));
    }
  }

  return {
    crumbs: [HOME, { label: 'Health' }],
    node: spread({
      no: '02', title: 'Health',
      lede: 'Appointments, tests and vaccinations, kept in date order.',
      actions: [act('Add +', '#/records/new')],
    }, body),
  };
}

// ---- one record --------------------------------------------------------------

export async function recordDetail({ params }) {
  const r = await db.get('records', params.id);
  if (!r) return { redirect: 'records' };
  const rem = reminderOf(r);
  const title = recordTitle(r);

  async function setDone(done) {
    await db.put('records', { ...r, reminder: { ...r.reminder, done, doneAt: done ? Date.now() : null, doneBy: null }, updatedAt: Date.now() });
    toast(done ? 'Reminder marked as done' : 'Reminder reopened');
    refresh();
  }
  async function del() {
    const ok = await confirmDialog({ title: 'Delete this record?', body: 'Its reminder and attachments are deleted with it. This cannot be undone.' });
    if (!ok) return;
    await removeFiles(r.fileIds);
    await db.remove('records', r.id);
    toast('Record deleted');
    navigate('records', { replace: true });
  }

  const reminderBlock = rem && h('div', { class: 'reminder-block' },
    h('p', { class: 'reminder-block__due' }, fmtDate(rem.due)),
    h('p', { class: 'reminder-block__meta' + (rem.status === 'overdue' ? ' is-overdue' : '') },
      [rem.repeat, rem.status === 'done' ? 'Done' : dueInWords(rem.due)].filter(Boolean).join(' / ')),
    r.reminder.note && h('p', { class: 'reminder-block__note' }, r.reminder.note),
    h('div', { class: 'inline-actions' },
      rem.status === 'done'
        ? act('Reopen reminder', () => setDone(false), { quiet: true })
        : [act('Log this visit', `#/records/new?from=${r.id}`), act('Mark as done', () => setDone(true), { quiet: true })]));

  const body = h('div', null,
    defs([
      ['Date', fmtDate(r.date)],
      ['Provider', r.provider],
      ['Notes', r.notes, 'prose'],
      ['Next reminder', reminderBlock],
    ]),
    gallery(r.fileIds, { alt: title }));

  return {
    crumbs: [HOME, RECORDS, { label: title }],
    node: spread({
      kicker: 'Record', title,
      lede: fmtDate(r.date),
      actions: [act('Edit', `#/records/${r.id}/edit`), act('Delete', del, { quiet: true })],
    }, body),
  };
}

// ---- add / edit --------------------------------------------------------------

export async function recordForm({ params, query }) {
  const editing = params.id ? await db.get('records', params.id) : null;
  if (params.id && !editing) return { redirect: 'records' };
  const source = !editing && query.from ? await db.get('records', query.from) : null;

  const base = editing || {
    type: source?.type || (RECORD_TYPES.some((t) => t.id === query.type) ? query.type : 'medical'),
    customType: source?.customType || '',
    date: todayISO(),
    provider: source?.provider || '',
    notes: '',
    fileIds: [],
    reminder: source?.reminder
      ? { repeat: source.reminder.repeat === 'once' ? 'none' : source.reminder.repeat, every: source.reminder.every, unit: source.reminder.unit, note: source.reminder.note || '' }
      : null,
  };
  const rem = base.reminder || { repeat: 'none' };

  const type = select(RECORD_TYPES, base.type);
  const customType = input({ value: base.customType || '', placeholder: 'Dermatology, physiotherapy…', maxLength: 60 });
  const date = input({ type: 'date', value: base.date, required: true });
  const provider = input({ value: base.provider || '', placeholder: 'Clinic or practitioner', autocapitalize: 'words' });
  const notes = textarea({ value: base.notes || '' });
  const photos = photoField({ ids: base.fileIds || [] });

  const repeat = select(REPEATS, rem.repeat || 'none');
  const every = input({ type: 'number', min: 1, max: 999, step: 1, inputmode: 'numeric', value: rem.every || 2 });
  const unit = select(INTERVAL_UNITS, rem.unit || 'year');
  const due = input({ type: 'date', value: rem.due || '' });
  const note = input({ value: rem.note || '', placeholder: 'Routine cleaning', maxLength: 120 });

  const customTypeField = field('Name of this record', customType);
  const intervalField = h('div', { class: 'field field--pair' },
    field('Every', every), field('Unit', unit));
  const dueField = field('Remind me on', due);
  const noteField = field('Reminder note', note, { hint: 'Shown on the reminders timeline.' });
  const reminderDetails = h('div', { class: 'form__group' }, intervalField, dueField, noteField);

  let dueTouched = !!(editing && rem.due);
  due.addEventListener('input', () => { dueTouched = true; });

  const draft = () => ({ repeat: repeat.value, every: Number(every.value) || 0, unit: unit.value });
  function sync({ recompute = false } = {}) {
    customTypeField.hidden = type.value !== 'other';
    const r = repeat.value;
    reminderDetails.hidden = r === 'none';
    intervalField.hidden = r !== 'custom';
    dueField.querySelector('label').textContent = r === 'once' ? 'Remind me on' : 'Next due';
    if (r !== 'none' && r !== 'once' && (recompute || !dueTouched)) {
      const computed = dueFrom(date.value, draft());
      if (computed) { due.value = computed; dueTouched = false; }
    }
  }
  type.addEventListener('change', () => sync());
  repeat.addEventListener('change', () => sync({ recompute: true }));
  every.addEventListener('input', () => sync({ recompute: true }));
  unit.addEventListener('change', () => sync({ recompute: true }));
  date.addEventListener('change', () => sync());
  sync();

  let saved = false;
  const cancelHref = editing ? `#/records/${editing.id}` : source ? `#/records/${source.id}` : '#/records';

  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!date.value) return formError(form, 'Choose the date of this record.');
    if (type.value === 'other' && !customType.value.trim()) return formError(form, 'Give this record a name, or choose a type from the list.');
    if (repeat.value === 'custom' && !(Number(every.value) > 0)) return formError(form, 'Enter how often the reminder repeats.');
    if (repeat.value !== 'none' && !due.value) return formError(form, 'Choose the date to be reminded on.');

    const now = Date.now();
    const prev = editing?.reminder;
    let reminder = null;
    if (repeat.value !== 'none') {
      const keepDone = prev && prev.due === due.value && prev.done;
      reminder = {
        ...draft(), due: due.value, note: note.value.trim(),
        done: !!keepDone, doneAt: keepDone ? prev.doneAt : null, doneBy: keepDone ? prev.doneBy : null,
      };
    }
    const record = {
      id: editing?.id || uid(),
      type: type.value,
      customType: type.value === 'other' ? customType.value.trim() : '',
      date: date.value,
      provider: provider.value.trim(),
      notes: notes.value.trim(),
      fileIds: photos.value(),
      reminder,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
    await db.put('records', record);
    await photos.commit();
    saved = true;

    let closed = 0;
    if (!editing) {
      const earlier = closeEarlierReminders(record, await db.all('records'));
      if (earlier.length) await db.putMany('records', earlier);
      closed = earlier.length;
    }
    toast(closed ? 'Record saved. The earlier reminder is now done.' : 'Record saved');
    navigate(`records/${record.id}`, { replace: true });
  } },
    field('Record type', type),
    customTypeField,
    field('Date', date),
    field('Provider / clinic', provider),
    field('Notes', notes),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Photos and documents'), photos.node),
    h('div', { class: 'form__section', role: 'group', 'aria-label': 'Next reminder' },
      h('p', { class: 'label' }, 'Next reminder'),
      field('Repeat', repeat, { hint: 'Reminders appear on the Reminders page. Filing the next record of this type closes the old one.' }),
      reminderDetails),
    formActions({ submit: editing ? 'Save changes' : 'Save record', cancelHref }),
  );

  const label = editing ? 'Edit' : 'New record';
  return {
    crumbs: editing
      ? [HOME, RECORDS, { label: recordTitle(editing), href: `#/records/${editing.id}` }, { label }]
      : [HOME, RECORDS, { label }],
    node: spread({
      kicker: 'Health',
      title: editing ? 'Edit record' : source ? `Log ${recordTitle(source).toLowerCase()}` : 'New record',
      lede: source ? `Following on from ${fmtShort(source.date)}.` : null,
    }, form),
    cleanup: () => { if (!saved) photos.discard(); },
  };
}
