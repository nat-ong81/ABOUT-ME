import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { INVENTORY_STATUSES } from '../config.js';
import { navigate, refresh } from '../router.js';
import { removeFiles } from '../attachments.js';
import {
  spread, act, empty, field, input, select, formActions, formError,
  photoField, picture, confirmDialog, toast,
} from '../ui/components.js';
import { inventoryView, productTitle, statusName } from '../domain/model.js';
import { uid, byText, plural } from '../util.js';

const HOME = { label: 'My Index', href: '#/' };
const INVENTORY = { label: 'Inventory', href: '#/inventory' };

async function load() {
  const [items, products] = await Promise.all([db.all('inventory'), db.all('products')]);
  const productsById = new Map(products.map((p) => [p.id, p]));
  const rows = items.map((item) => ({ item, v: inventoryView(item, productsById) }))
    .sort(byText((r) => `${r.v.brand} ${r.v.name}`));
  return { rows, products };
}

async function update(item, changes, message) {
  await db.put('inventory', { ...item, ...changes, updatedAt: Date.now() });
  if (message) toast(message);
  refresh();
}

function row({ item, v }, { archived = false } = {}) {
  const status = h('div', { class: 'status', role: 'group', 'aria-label': 'Status' },
    INVENTORY_STATUSES.map((s) => h('button', {
      class: 'status__opt', type: 'button', 'aria-pressed': String(item.status === s.id),
      onclick: () => item.status !== s.id && update(item, { status: s.id }),
    }, s.name)));

  return h('li', { class: 'stock' },
    h('a', { class: 'stock__pic', href: `#/inventory/${item.id}/edit`, 'aria-label': `Edit ${v.name}` },
      picture(v.fileId, { thumb: true, alt: '', placeholder: (v.brand || v.name).slice(0, 1) })),
    h('div', { class: 'stock__main' },
      v.brand && h('p', { class: 'label' }, v.brand),
      h('p', { class: 'stock__name' }, v.product ? h('a', { href: `#/care/${v.product.category}/${v.product.id}` }, v.name) : v.name),
      v.shade && h('p', { class: 'stock__shade' }, v.shade)),
    h('div', { class: 'stock__state' },
      archived
        ? [h('span', { class: 'label' }, statusName(item.status)),
          act('Restore', () => update(item, { archived: false }, 'Moved back to inventory'), { quiet: true })]
        : [status, item.status === 'finished' && act('Archive', () => update(item, { archived: true }, 'Archived'))]));
}

export async function inventoryList() {
  const { rows } = await load();
  const active = rows.filter((r) => !r.item.archived);
  const archived = rows.length - active.length;

  const body = h('div', null,
    active.length
      ? h('ul', { class: 'stocks' }, active.map((r) => row(r)))
      : empty('Nothing here yet. Add what is on your shelf and keep its status up to date.', act('Add an item', '#/inventory/new')),
    archived ? h('p', { class: 'more' }, act(`Archive (${archived})`, '#/inventory/archive', { quiet: true })) : null);

  return {
    crumbs: [HOME, { label: 'Inventory' }],
    node: spread({
      no: '04', title: 'Inventory',
      lede: 'What I own at the moment, and how much is left.',
      actions: [act('Add an item', '#/inventory/new')],
    }, body),
  };
}

export async function inventoryArchive() {
  const { rows } = await load();
  const archived = rows.filter((r) => r.item.archived);
  return {
    crumbs: [HOME, INVENTORY, { label: 'Archive' }],
    node: spread({
      kicker: 'Inventory', title: 'Archive',
      lede: archived.length ? `${plural(archived.length, 'finished product')}.` : null,
    }, archived.length
      ? h('ul', { class: 'stocks' }, archived.map((r) => row(r, { archived: true })))
      : empty('Finished products you archive are kept here.')),
  };
}

export async function inventoryForm({ params, query }) {
  const { products } = await load();
  const editing = params.id ? await db.get('inventory', params.id) : null;
  if (params.id && !editing) return { redirect: 'inventory' };

  const sorted = [...products].sort(byText(productTitle));
  const startProduct = editing ? editing.productId || '' : (products.some((p) => p.id === query.product) ? query.product : '');
  const product = select([
    { id: '', name: 'Not in my Care library' },
    ...sorted.map((p) => ({ id: p.id, name: productTitle(p) + (p.shade ? `, ${p.shade}` : '') })),
  ], startProduct);
  const name = input({ value: editing?.name || '', placeholder: 'Product name', maxLength: 120 });
  const status = select(INVENTORY_STATUSES, editing?.status || 'open');
  const photos = photoField({ ids: editing?.fileIds || [], multiple: false, documents: false });

  const nameField = field('Product name', name);
  const sync = () => { nameField.hidden = !!product.value; };
  product.addEventListener('change', sync);
  sync();

  async function del() {
    if (!(await confirmDialog({ title: 'Remove this item?', body: 'The product stays in your Care library.', confirm: 'Remove' }))) return;
    await removeFiles(editing.fileIds);
    await db.remove('inventory', editing.id);
    saved = true;
    toast('Item removed');
    navigate('inventory', { replace: true });
  }

  let saved = false;
  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!product.value && !name.value.trim()) return formError(form, 'Choose a product from your library, or enter its name.');
    const now = Date.now();
    await db.put('inventory', {
      id: editing?.id || uid(),
      productId: product.value || null,
      name: product.value ? '' : name.value.trim(),
      fileIds: photos.value(),
      status: status.value,
      archived: editing?.archived || false,
      createdAt: editing?.createdAt || now, updatedAt: now,
    });
    await photos.commit();
    saved = true;
    toast('Saved');
    navigate(editing?.archived ? 'inventory/archive' : 'inventory', { replace: true });
  } },
    field('Product', product, { hint: sorted.length ? null : 'Products you add under 03 Care can be chosen here.' }),
    nameField,
    field('Status', status),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Photo'), photos.node,
      h('p', { class: 'hint' }, 'Optional. A product from your library uses its own photo.')),
    formActions({ submit: editing ? 'Save changes' : 'Add to inventory', cancelHref: '#/inventory', onDelete: editing ? del : null, deleteLabel: 'Remove item' }));

  return {
    crumbs: [HOME, INVENTORY, { label: editing ? 'Edit' : 'New item' }],
    node: spread({ kicker: 'Inventory', title: editing ? 'Edit item' : 'New item' }, form),
    cleanup: () => { if (!saved) photos.discard(); },
  };
}
