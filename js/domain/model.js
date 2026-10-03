// Small helpers that describe entities for display. No storage here.

import { ME_GROUPS, CARE_CATEGORIES, INVENTORY_STATUSES, RX_EYES, RX_COLUMNS } from '../config.js';
import { fmtShort } from '../util.js';

export const builtinGroup = (id) => ME_GROUPS.find((g) => g.id === id) || null;
export const categoryName = (id) => CARE_CATEGORIES.find((c) => c.id === id)?.name || 'Other';
export const statusName = (id) => INVENTORY_STATUSES.find((s) => s.id === id)?.name || 'Open';

// All "Me" sections in display order: built-in first, then custom ones.
export function allGroups(customGroups) {
  return [
    ...ME_GROUPS.map((g) => ({ ...g, custom: false })),
    ...[...customGroups].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map((g) => ({ id: g.id, name: g.name, item: 'Entry', custom: true, photos: true })),
  ];
}

export function meTitle(entry, group) {
  const d = entry.data || {};
  if (group?.layout === 'rx') return d.issued ? `Prescription, ${fmtShort(d.issued)}` : 'Prescription';
  if (group?.custom) return d.title || 'Untitled';
  return d[group?.titleKey] || 'Untitled';
}

export function meSummary(entry, group) {
  const d = entry.data || {};
  if (group?.id === 'medication') return [d.dosage, d.frequency].filter(Boolean).join(', ');
  if (group?.id === 'allergies') return d.reaction || '';
  if (group?.layout === 'rx') return d.optometrist || '';
  if (group?.custom) return (entry.pairs || []).filter((p) => p.value).map((p) => (p.label ? `${p.label} ${p.value}` : p.value)).join(', ');
  return '';
}

export function meText(entry, group) {
  const d = entry.data || {};
  const parts = [group?.name, group?.item, ...Object.values(d)];
  for (const p of entry.pairs || []) parts.push(p.label, p.value);
  if (group?.layout === 'rx') parts.push('glasses prescription', ...RX_EYES.map((e) => e.name), ...RX_COLUMNS.map((c) => c.name));
  return parts.filter(Boolean).join(' ');
}

export const productTitle = (p) => [p?.brand, p?.name].filter(Boolean).join(' ') || 'Untitled product';

// An inventory item either points at a Care product or carries its own name.
export function inventoryView(item, productsById) {
  const product = item.productId ? productsById.get(item.productId) : null;
  return {
    product,
    brand: product?.brand || '',
    name: product ? product.name || 'Untitled product' : item.name || 'Untitled item',
    shade: product?.shade || '',
    fileId: item.fileIds?.[0] || product?.fileIds?.[0] || null,
  };
}
