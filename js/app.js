// INDEX OF ME — start-up.
//
// Layers, from the bottom up:
//   storage/   db (structured data), files (photos), prefs (settings)
//   domain/    reminders, search and naming rules; no DOM, no storage details
//   ui/        small building blocks
//   views/     one module per section; each returns a page for the router

import { h } from './ui/dom.js';
import { initStorage, requestPersistence } from './storage/index.js';
import { defineRoutes, startRouter, stopView, rerender } from './router.js';
import { applyTheme } from './theme.js';
import { lock } from './lock.js';
import { platform } from './platform.js';
import { lockScreen } from './ui/lockscreen.js';
import { spread, act } from './ui/components.js';

import { home } from './views/home.js';
import { recordsList, recordDetail, recordForm } from './views/records.js';
import { mePage, meDetail, meForm, meSectionForm } from './views/me.js';
import { careIndex, careCategory, productDetail, productForm } from './views/care.js';
import { inventoryList, inventoryArchive, inventoryForm } from './views/inventory.js';
import { remindersPage } from './views/reminders.js';
import { searchPage } from './views/search.js';
import { settingsPage } from './views/settings.js';

const outlet = document.getElementById('view');
const crumbsEl = document.getElementById('crumbs');
const toolsEl = document.getElementById('tools');

async function notFound(ctx = {}) {
  return {
    crumbs: [{ label: 'My Index', href: '#/' }, { label: ctx.error ? 'Problem' : 'Not found' }],
    node: spread({
      kicker: 'My Index',
      title: ctx.error ? 'This page could not be opened' : 'Nothing is filed here',
      lede: ctx.error ? 'Your data has not been changed. Go back to the index and try again.' : 'The page may have been deleted.',
      actions: [act('Back to my index', '#/')],
    }, h('div')),
  };
}

defineRoutes([
  ['', home],
  ['records', recordsList],
  ['records/new', recordForm],
  ['records/:id', recordDetail],
  ['records/:id/edit', recordForm],
  ['me', mePage],
  ['me/sections/new', meSectionForm],
  ['me/sections/:id/edit', meSectionForm],
  ['me/:group/new', meForm],
  ['me/:group/:id', meDetail],
  ['me/:group/:id/edit', meForm],
  ['care', careIndex],
  ['care/new', productForm],
  ['care/:category', careCategory],
  ['care/:category/:id', productDetail],
  ['care/:category/:id/edit', productForm],
  ['inventory', inventoryList],
  ['inventory/archive', inventoryArchive],
  ['inventory/new', inventoryForm],
  ['inventory/:id/edit', inventoryForm],
  ['reminders', remindersPage],
  ['search', searchPage],
  ['settings', settingsPage],
], notFound);

// Breadcrumb bar, e.g.  MY INDEX / CARE / SKINCARE / PRODUCT
function chrome(result) {
  const crumbs = result.crumbs || [];
  const isHome = !crumbs.length;
  crumbsEl.replaceChildren(...(isHome
    ? [h('span', { class: 'crumbs__here' }, 'Index of Me')]
    : crumbs.flatMap((c, i) => [
      i > 0 && h('span', { class: 'crumbs__sep', 'aria-hidden': 'true' }, '/'),
      c.href ? h('a', { href: c.href }, c.label) : h('span', { class: 'crumbs__here', 'aria-current': 'page' }, c.label),
    ]).filter(Boolean)));
  crumbsEl.scrollLeft = 0;
  // On a narrow screen the page title sits right below, so when the current
  // page's crumb would be cut to a stub, leave it out and keep the path tappable.
  const here = crumbsEl.querySelector('.crumbs__here[aria-current]');
  if (here && here.scrollWidth > here.clientWidth && here.clientWidth < 72) {
    here.previousElementSibling?.remove();
    here.remove();
  }
  toolsEl.replaceChildren(isHome
    ? h('a', { href: '#/settings' }, 'Settings')
    : result.hideSearch ? '' : h('a', { href: '#/search' }, 'Search'));
  const pageName = crumbs.length ? crumbs[crumbs.length - 1].label : null;
  document.title = pageName ? `${pageName} – Index of Me` : 'Index of Me';
}

// ---- privacy lock -------------------------------------------------------------

let hiddenAt = null;
let locking = false;

async function engageLock() {
  if (locking || !lock.isEnabled()) return;
  locking = true;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  stopView();
  await lockScreen();
  locking = false;
  rerender();
}

function watchVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (!lock.isEnabled()) { document.body.classList.remove('is-veiled'); return; }
    if (document.hidden) {
      hiddenAt = Date.now();
      document.body.classList.add('is-veiled'); // keeps the app-switcher preview blank
    } else {
      const away = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0;
      hiddenAt = null;
      document.body.classList.remove('is-veiled');
      if (away >= lock.timeout()) engageLock();
    }
  });
  window.addEventListener('iom:lock', engageLock);
}

// ---- start --------------------------------------------------------------------

async function boot() {
  applyTheme();
  try {
    await initStorage();
  } catch (err) {
    console.error(err);
    outlet.replaceChildren(spread({
      kicker: 'Index of Me', title: 'Storage is unavailable',
      lede: 'This browser is not letting the app save anything, which usually means private browsing is on. Open it in a normal window.',
    }, h('div')));
    return;
  }

  if (platform.standalone) requestPersistence();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Offline support is unavailable:', err));
  }

  if (lock.isEnabled()) await lockScreen();
  watchVisibility();
  await startRouter({ outlet, onRender: chrome });
}

boot();
