// Reminders are never entered on their own. Each one is read from the
// `reminder` part of a record:
//
//   reminder: { repeat, every, unit, due, note, done, doneAt, doneBy }
//
// A reminder stays open until a newer record of the same type is filed
// (see closeEarlierReminders) or it is marked done by hand.

import { RECORD_TYPES, REPEATS, INTERVAL_UNITS } from '../config.js';
import { addInterval, daysBetween, todayISO, plural } from '../util.js';
import { inventoryView } from './model.js';

const typeById = Object.fromEntries(RECORD_TYPES.map((t) => [t.id, t]));

export function recordTitle(r) {
  if (!r) return '';
  if (r.type === 'other') return (r.customType || '').trim() || 'Other';
  return typeById[r.type]?.name || 'Record';
}
export const recordKeywords = (r) => typeById[r.type]?.keywords || '';

// Two records are "the same kind" when a new one should close the other's reminder.
export function sameKind(a, b) {
  if (a.type !== b.type) return false;
  if (a.type !== 'other') return true;
  return (a.customType || '').trim().toLowerCase() === (b.customType || '').trim().toLowerCase();
}

export function intervalOf(reminder) {
  if (!reminder) return null;
  if (reminder.repeat === 'custom') return { every: Number(reminder.every) || 0, unit: reminder.unit || 'month' };
  const preset = REPEATS.find((p) => p.id === reminder.repeat);
  return preset?.every ? { every: preset.every, unit: preset.unit } : null;
}

export function dueFrom(dateISO, reminder) {
  const i = intervalOf(reminder);
  return i && i.every ? addInterval(dateISO, i.every, i.unit) : '';
}

export function repeatLabel(reminder) {
  if (!reminder || reminder.repeat === 'none') return '';
  if (reminder.repeat === 'custom') {
    const n = Number(reminder.every) || 0;
    const unit = INTERVAL_UNITS.find((u) => u.id === reminder.unit)?.name || 'months';
    return n === 1 ? `Every ${unit.replace(/s$/, '')}` : `Every ${n} ${unit}`;
  }
  return REPEATS.find((p) => p.id === reminder.repeat)?.name || '';
}

export function reminderOf(record, today = todayISO()) {
  const rem = record?.reminder;
  if (!rem || rem.repeat === 'none' || !rem.due) return null;
  const status = rem.done ? 'done' : rem.due < today ? 'overdue' : 'upcoming';
  return {
    id: record.id,
    recordId: record.id,
    href: `#/records/${record.id}`,
    due: rem.due,
    title: recordTitle(record),
    note: (rem.note || '').trim() || record.provider || '',
    repeat: repeatLabel(rem),
    status,
    record,
  };
}

export function remindersFrom(records, today = todayISO()) {
  return records.map((r) => reminderOf(r, today)).filter(Boolean)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
}

export function nextUpcoming(records, today = todayISO()) {
  return remindersFrom(records, today).find((r) => r.status === 'upcoming') || null;
}

// Inventory items that expire within six months are reminders too.
export function expiryReminders(items, nameOf, today = todayISO()) {
  const limit = addInterval(today, 6, 'month');
  return items
    .filter((i) => i.expiry && !i.archived && i.status !== 'finished' && i.expiry <= limit)
    .map((i) => {
      const expired = i.expiry < today;
      return {
        id: 'inv-' + i.id, kind: 'expiry', due: i.expiry, href: `#/inventory/${i.id}/edit`,
        title: expired ? 'Expired' : 'Expiring', note: nameOf(i), repeat: 'Inventory',
        status: expired ? 'overdue' : 'upcoming',
      };
    });
}

export function allReminders(records, inventory = [], products = [], today = todayISO()) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const nameOf = (i) => { const v = inventoryView(i, byId); return [v.brand, v.name].filter(Boolean).join(' '); };
  return [...remindersFrom(records, today), ...expiryReminders(inventory, nameOf, today)]
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
}

// When a new record is filed, earlier open reminders of the same kind are done.
export function closeEarlierReminders(newRecord, records) {
  const changed = [];
  for (const r of records) {
    if (r.id === newRecord.id || !r.reminder || r.reminder.done || r.reminder.repeat === 'none') continue;
    if (!sameKind(r, newRecord) || r.date > newRecord.date) continue;
    changed.push({ ...r, reminder: { ...r.reminder, done: true, doneAt: Date.now(), doneBy: newRecord.id } });
  }
  return changed;
}

export function dueInWords(due, today = todayISO()) {
  const n = daysBetween(today, due);
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n > 1) return n < 60 ? `Due in ${plural(n, 'day')}` : `Due in ${plural(Math.round(n / 30.4), 'month')}`;
  const late = -n;
  return late < 60 ? `Overdue by ${plural(late, 'day')}` : `Overdue by ${plural(Math.round(late / 30.4), 'month')}`;
}
