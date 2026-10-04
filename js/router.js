// Hash-based page router. Hash URLs work unchanged on any static host,
// inside an installed PWA and inside a Capacitor web view.
//
// A view is an async function ({ params, query }) that returns
//   { crumbs: [{ label, href? }], node, cleanup? }   or   { redirect: 'path' }

import { releaseUrls } from './attachments.js';

let routes = [];
let outlet = null;
let afterRender = null;
let fallback = null;
let current = null;
let forward = false;
let token = 0;
const scrolls = new Map();

export function defineRoutes(table, notFound) {
  routes = table.map(([pattern, view]) => ({ parts: pattern.split('/').filter(Boolean), view }));
  fallback = notFound;
}

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  let segs;
  try { segs = path.split('/').filter(Boolean).map(decodeURIComponent); } catch { segs = ['404']; }
  return { segs, query: Object.fromEntries(new URLSearchParams(qs)) };
}

function match(segs) {
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const p = r.parts[i];
      if (p[0] === ':') params[p.slice(1)] = segs[i];
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (ok) return { view: r.view, params };
  }
  return { view: fallback, params: {} };
}

export function navigate(to, { replace = false } = {}) {
  const hash = '#/' + String(to).replace(/^#?\/?/, '');
  forward = true;
  if (replace) { history.replaceState(null, '', hash); render(); }
  else if (location.hash === hash) render();
  else location.hash = hash;
}

export function refresh() {
  const y = window.scrollY;
  return render({ keepScroll: y });
}

async function render({ keepScroll = null } = {}) {
  const mine = ++token;
  const key = location.hash;
  if (current) {
    scrolls.set(current.key, window.scrollY);
    try { current.cleanup?.(); } catch (err) { console.error(err); }
    current = null;
  }
  releaseUrls();

  const { segs, query } = parse();
  const m = match(segs);
  let result;
  try {
    result = await m.view({ params: m.params, query });
  } catch (err) {
    console.error(err);
    result = await fallback({ error: err });
  }
  if (mine !== token) { try { result?.cleanup?.(); } catch { /* superseded */ } return; }
  if (result.redirect != null) { navigate(result.redirect, { replace: true }); return; }

  outlet.replaceChildren(result.node);
  if (keepScroll == null) {
    outlet.classList.remove('is-entering');
    void outlet.offsetWidth; // restart the transition
    outlet.classList.add('is-entering');
  }
  afterRender?.(result);
  current = { key, cleanup: result.cleanup };

  const y = keepScroll ?? (forward ? 0 : scrolls.get(key) ?? 0);
  forward = false;
  window.scrollTo(0, y);
}

export function startRouter({ outlet: el, onRender }) {
  outlet = el;
  afterRender = onRender;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // Taps on in-app links are forward navigation: start at the top of the page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#/"]');
    if (a && !e.defaultPrevented) forward = true;
  });
  window.addEventListener('hashchange', () => render());
  return render();
}

export function stopView() {
  if (current) { try { current.cleanup?.(); } catch { /* ignore */ } current = null; }
  releaseUrls();
  outlet?.replaceChildren();
}

export const rerender = () => render();
