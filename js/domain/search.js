// Global search across every section. Each word of the query must appear
// somewhere in an item's text (matching is case- and accent-insensitive).

import { db } from '../storage/index.js';
import { fmtDate, fmtShort } from '../util.js';
import { recordTitle, recordKeywords, remindersFrom } from './reminders.js';
import { allGroups, meTitle, meSummary, meText, categoryName, statusName, inventoryView, productTitle } from './model.js';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function tokens(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

function matches(text, words) {
  const hay = fold(text);
  return words.every((w) => hay.includes(w));
}

export async function searchAll(query) {
  const words = tokens(query);
  const empty = { total: 0, groups: [] };
  if (!words.length) return empty;

  const [records, me, groups, products, inventory] = await Promise.all(
    ['records', 'me', 'groups', 'products', 'inventory'].map((s) => db.all(s)),
  );
  const out = [];

  // 01 Records
  const recordHits = records
    .filter((r) => matches([recordTitle(r), recordKeywords(r), r.provider, r.notes, r.reminder?.note, fmtDate(r.date)].join(' '), words))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({ href: `#/records/${r.id}`, label: fmtShort(r.date), title: recordTitle(r), sub: r.provider || r.notes || '' }));
  if (recordHits.length) out.push({ id: 'records', no: '01', name: 'Records', items: recordHits });

  // 05 Reminders (derived from records)
  const reminderHits = remindersFrom(records)
    .filter((r) => r.status !== 'done')
    .filter((r) => matches([r.title, recordKeywords(r.record), r.note, r.record.provider, r.repeat, 'reminder', fmtDate(r.due)].join(' '), words))
    .map((r) => ({
      href: `#/records/${r.recordId}`,
      label: fmtShort(r.due) + (r.status === 'overdue' ? ', overdue' : ''),
      title: r.title,
      sub: r.note,
    }));

  // 02 Me
  const groupList = allGroups(groups);
  const groupById = new Map(groupList.map((g) => [g.id, g]));
  const meHits = me
    .filter((e) => groupById.has(e.group) && matches(meText(e, groupById.get(e.group)), words))
    .map((e) => {
      const g = groupById.get(e.group);
      return { href: `#/me/${g.id}/${e.id}`, label: g.name, title: meTitle(e, g), sub: meSummary(e, g) };
    });
  if (meHits.length) out.push({ id: 'me', no: '02', name: 'Me', items: meHits });

  // 03 Care
  const productHits = products
    .filter((p) => matches([p.brand, p.name, p.shade, p.notes, categoryName(p.category), p.favourite ? 'favourite favorite' : '', p.url].join(' '), words))
    .sort((a, b) => productTitle(a).localeCompare(productTitle(b)))
    .map((p) => ({
      href: `#/care/${p.category}/${p.id}`,
      label: categoryName(p.category),
      title: productTitle(p),
      sub: p.shade || p.notes || '',
      fileId: p.fileIds?.[0] || null,
    }));
  if (productHits.length) out.push({ id: 'care', no: '03', name: 'Care', items: productHits });

  // 04 Inventory
  const productsById = new Map(products.map((p) => [p.id, p]));
  const inventoryHits = inventory
    .map((item) => ({ item, v: inventoryView(item, productsById) }))
    .filter(({ item, v }) => matches([v.brand, v.name, v.shade, v.product?.notes, statusName(item.status), item.archived ? 'archived' : 'inventory'].join(' '), words))
    .map(({ item, v }) => ({
      href: item.archived ? '#/inventory/archive' : `#/inventory/${item.id}/edit`,
      label: statusName(item.status) + (item.archived ? ', archived' : ''),
      title: [v.brand, v.name].filter(Boolean).join(' '),
      sub: v.shade,
      fileId: v.fileId,
    }));
  if (inventoryHits.length) out.push({ id: 'inventory', no: '04', name: 'Inventory', items: inventoryHits });

  if (reminderHits.length) out.push({ id: 'reminders', no: '05', name: 'Reminders', items: reminderHits });

  return { total: out.reduce((n, g) => n + g.items.length, 0), groups: out };
}
