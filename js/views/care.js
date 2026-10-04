import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { CARE_CATEGORIES, INVENTORY_STATUSES } from '../config.js';
import { navigate, refresh } from '../router.js';
import { removeFiles } from '../attachments.js';
import {
  spread, act, filters, empty, field, input, textarea, select, formActions, formError,
  photoField, picture, gallery, confirmDialog, toast, sectionLabel,
} from '../ui/components.js';
import { categoryName, statusName, productTitle } from '../domain/model.js';
import { uid, safeUrl, hostOf, byText, plural } from '../util.js';

const HOME = { label: 'Home', href: '#/' };
const CARE = { label: 'Self-care', href: '#/care' };
const isCategory = (id) => CARE_CATEGORIES.some((c) => c.id === id);
const sortProducts = (list) => list.sort(byText((p) => `${p.brand} ${p.name}`));

function productGrid(products) {
  return h('ul', { class: 'grid' }, products.map((p) => h('li', null,
    h('a', { class: 'plate', href: `#/care/${p.category}/${p.id}` },
      picture(p.fileIds?.[0], { thumb: true, alt: '', cls: 'plate__pic', placeholder: p.brand || p.name }),
      h('span', { class: 'label plate__brand' }, p.brand || categoryName(p.category), p.favourite && h('span', { class: 'plate__fav', title: 'Favourite' }, 'Favourite')),
      h('span', { class: 'plate__name' }, p.name || 'Untitled'),
      p.shade && h('span', { class: 'plate__shade' }, p.shade)))));
}

// ---- library index -----------------------------------------------------------

export async function careIndex() {
  const products = await db.all('products');
  const favourites = products.filter((p) => p.favourite).length;

  const rows = CARE_CATEGORIES.map((c, i) => {
    const n = products.filter((p) => p.category === c.id).length;
    return h('a', { class: 'index__row', href: `#/care/${c.id}` },
      h('span', { class: 'index__no' }, `03.${i + 1}`),
      h('span', { class: 'index__name' }, c.name),
      h('span', { class: 'index__count' }, n ? String(n) : ''));
  });

  const body = h('div', null,
    h('nav', { class: 'index index--sub', 'aria-label': 'Categories' }, rows,
      h('a', { class: 'index__row', href: '#/care/favourites' },
        h('span', { class: 'index__no' }, ''),
        h('span', { class: 'index__name' }, 'Favourites'),
        h('span', { class: 'index__count' }, favourites ? String(favourites) : ''))),
    !products.length && empty('Your product library is empty. Add the things you use and would buy again.', act('Add a product', '#/care/new')));

  return {
    crumbs: [HOME, { label: 'Self-care' }],
    node: spread({
      no: '03', title: 'Self-care',
      lede: 'A library of products, shades and where to find them.',
      actions: [act('Add +', '#/care/new')],
    }, body),
  };
}

// ---- one category ------------------------------------------------------------

export async function careCategory({ params }) {
  const id = params.category;
  const fav = id === 'favourites';
  if (!fav && !isCategory(id)) return { redirect: 'care' };
  const all = await db.all('products');
  const products = sortProducts(all.filter((p) => (fav ? p.favourite : p.category === id)));
  const name = fav ? 'Favourites' : categoryName(id);

  const body = h('div', null,
    filters([
      ...CARE_CATEGORIES.map((c) => ({ id: c.id, name: c.name, href: `#/care/${c.id}` })),
      { id: 'favourites', name: 'Favourites', href: '#/care/favourites' },
    ], id, { label: 'Category' }),
    products.length
      ? productGrid(products)
      : empty(fav ? 'No favourites yet. Mark a product as a favourite from its page.' : `No ${name.toLowerCase()} yet.`,
        !fav && act('Add a product', `#/care/new?category=${id}`)));

  return {
    crumbs: [HOME, CARE, { label: name }],
    node: spread({
      kicker: 'Self-care', title: name,
      lede: products.length ? plural(products.length, 'product') : null,
      actions: fav ? [] : [act('Add +', `#/care/new?category=${id}`)],
    }, body, { wide: true }),
  };
}

// ---- product page ------------------------------------------------------------

export async function productDetail({ params }) {
  const p = await db.get('products', params.id);
  if (!p) return { redirect: 'care' };
  const owned = (await db.all('inventory')).filter((i) => i.productId === p.id);
  const url = safeUrl(p.url);
  const [cover, ...more] = p.fileIds || [];

  async function toggleFavourite() {
    await db.put('products', { ...p, favourite: !p.favourite, updatedAt: Date.now() });
    refresh();
  }
  async function del() {
    const ok = await confirmDialog({
      title: 'Delete this product?',
      body: owned.length ? 'It is also removed from your inventory. This cannot be undone.' : 'This cannot be undone.',
    });
    if (!ok) return;
    for (const i of owned) { await removeFiles(i.fileIds); await db.remove('inventory', i.id); }
    await removeFiles(p.fileIds);
    await db.remove('products', p.id);
    toast('Product deleted');
    navigate(`care/${p.category}`, { replace: true });
  }

  const node = h('article', { class: 'product' },
    h('div', { class: 'product__plate' },
      cover ? gallery([cover], { alt: productTitle(p) }) : picture(null, { cls: 'product__blank', placeholder: p.brand || p.name })),
    h('div', { class: 'product__text' },
      h('p', { class: 'label' }, p.brand || categoryName(p.category)),
      h('h1', { class: 'title product__name' }, p.name || 'Untitled'),
      p.shade && h('p', { class: 'product__shade' }, p.shade),
      h('div', { class: 'product__actions' },
        h('button', { class: 'fav', type: 'button', 'aria-pressed': String(!!p.favourite), onclick: toggleFavourite },
          h('span', { class: 'fav__mark', 'aria-hidden': 'true' }), p.favourite ? 'Favourite' : 'Mark as favourite'),
        url && h('a', { class: 'act', href: url, target: '_blank', rel: 'noopener noreferrer' }, `Shop at ${hostOf(url)}`)),
      p.notes && h('div', { class: 'product__notes' }, h('p', { class: 'label' }, 'Notes'), h('p', { class: 'prose' }, p.notes)),
      h('div', { class: 'product__owned' },
        sectionLabel('In my inventory', h('span', { class: 'section-label__actions' }, act('Add', `#/inventory/new?product=${p.id}`))),
        owned.length
          ? h('ul', { class: 'lines' }, owned.map((i) => h('li', null, h('a', { class: 'lines__row', href: i.archived ? '#/inventory/archive' : '#/inventory' },
            h('span', { class: 'lines__title' }, statusName(i.status)),
            h('span', { class: 'lines__sub' }, i.archived ? 'Archived' : '')))))
          : h('p', { class: 'sheet__empty' }, 'Not in your inventory.')),
      h('div', { class: 'inline-actions product__manage' }, act('Edit', `#/care/${p.category}/${p.id}/edit`), act('Delete', del, { quiet: true }))),
    more.length ? h('div', { class: 'product__more' }, gallery(more, { alt: productTitle(p) })) : null);

  return {
    crumbs: [HOME, CARE, { label: categoryName(p.category), href: `#/care/${p.category}` }, { label: p.name || 'Product' }],
    node,
  };
}

// ---- add / edit --------------------------------------------------------------

export async function productForm({ params, query }) {
  const editing = params.id ? await db.get('products', params.id) : null;
  if (params.id && !editing) return { redirect: 'care' };
  const startCategory = editing?.category || (isCategory(query.category) ? query.category : 'skincare');

  const brand = input({ value: editing?.brand || '', autocapitalize: 'words', maxLength: 80 });
  const name = input({ value: editing?.name || '', maxLength: 120 });
  const category = select(CARE_CATEGORIES, startCategory);
  const shade = input({ value: editing?.shade || '', placeholder: 'Shade, size or scent', maxLength: 80 });
  const notes = textarea({ value: editing?.notes || '' });
  const url = input({ type: 'url', inputmode: 'url', autocapitalize: 'off', value: editing?.url || '', placeholder: 'https://' });
  const favourite = h('input', { type: 'checkbox', class: 'check__box', checked: !!editing?.favourite, id: 'fav-check' });
  const photos = photoField({ ids: editing?.fileIds || [], documents: false });
  const own = !editing && h('input', { type: 'checkbox', class: 'check__box', id: 'own-check' });
  const ownStatus = !editing && select(INVENTORY_STATUSES, 'open');
  const ownStatusField = own && field('Status', ownStatus);
  if (own) { ownStatusField.hidden = true; own.addEventListener('change', () => { ownStatusField.hidden = !own.checked; }); }

  let saved = false;
  const back = editing ? `#/care/${editing.category}/${editing.id}` : (isCategory(query.category) ? `#/care/${query.category}` : '#/care');

  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!name.value.trim() && !brand.value.trim()) return formError(form, 'Enter a brand or a product name.');
    if (url.value.trim() && !safeUrl(url.value)) return formError(form, 'The shop link should be a web address, such as https://example.com.');
    const now = Date.now();
    const product = {
      id: editing?.id || uid(),
      brand: brand.value.trim(), name: name.value.trim(), category: category.value,
      shade: shade.value.trim(), notes: notes.value.trim(), favourite: favourite.checked,
      url: safeUrl(url.value), fileIds: photos.value(),
      createdAt: editing?.createdAt || now, updatedAt: now,
    };
    await db.put('products', product);
    await photos.commit();
    if (own?.checked) {
      await db.put('inventory', { id: uid(), productId: product.id, name: '', fileIds: [], status: ownStatus.value, archived: false, createdAt: now, updatedAt: now });
    }
    saved = true;
    toast('Product saved');
    navigate(`care/${product.category}/${product.id}`, { replace: true });
  } },
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Product photo'), photos.node),
    field('Brand', brand),
    field('Product name', name),
    field('Category', category),
    field('Shade / variant', shade),
    field('Notes', notes),
    field('Shop link', url),
    h('label', { class: 'check', for: 'fav-check' }, favourite, h('span', null, 'Favourite')),
    own && h('label', { class: 'check', for: 'own-check' }, own, h('span', null, 'I own this now (add it to my inventory)')),
    ownStatusField,
    formActions({ submit: editing ? 'Save changes' : 'Save product', cancelHref: back }),
  );

  return {
    crumbs: editing
      ? [HOME, CARE, { label: categoryName(editing.category), href: `#/care/${editing.category}` }, { label: editing.name || 'Product', href: back }, { label: 'Edit' }]
      : [HOME, CARE, { label: 'New product' }],
    node: spread({ kicker: 'Self-care', title: editing ? 'Edit product' : 'New product' }, form),
    cleanup: () => { if (!saved) photos.discard(); },
  };
}
