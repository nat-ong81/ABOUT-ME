import { h } from '../ui/dom.js';
import { spread, picture } from '../ui/components.js';
import { searchAll } from '../domain/search.js';
import { debounce, plural } from '../util.js';

const HOME = { label: 'Home', href: '#/' };

export async function searchPage({ query }) {
  const start = (query.q || '').trim();
  const results = h('div', { class: 'results', 'aria-live': 'polite' });
  const input = h('input', {
    class: 'search__input search__input--page', type: 'search', value: start, placeholder: 'Search my index…',
    'aria-label': 'Search my index', autocomplete: 'off', autocapitalize: 'off', enterkeyhint: 'search',
  });

  let run = 0;
  async function show(q) {
    const mine = ++run;
    if (!q) {
      results.replaceChildren(h('p', { class: 'results__hint' }, 'Search records, reference details, products, inventory and reminders at once.'));
      return;
    }
    const found = await searchAll(q);
    if (mine !== run) return;
    if (!found.total) {
      results.replaceChildren(h('p', { class: 'results__hint' }, `Nothing in your index matches “${q}”.`));
      return;
    }
    results.replaceChildren(
      h('p', { class: 'label results__count' }, plural(found.total, 'result')),
      ...found.groups.map((g) => h('section', { class: 'results__group' },
        h('h2', { class: 'section-label' }, h('span', { class: 'label' }, g.name), h('span', { class: 'section-label__no' }, g.no)),
        h('ul', { class: 'lines' }, g.items.map((it) => h('li', null,
          h('a', { class: 'lines__row lines__row--result' + (it.fileId ? ' has-pic' : ''), href: it.href },
            it.fileId && picture(it.fileId, { thumb: true, cls: 'lines__pic' }),
            h('span', { class: 'lines__text' },
              h('span', { class: 'label' }, it.label),
              h('span', { class: 'lines__title' }, it.title),
              it.sub && h('span', { class: 'lines__sub' }, it.sub)))))))));
  }

  const sync = debounce((q) => {
    // Keep the query in the address so Back returns to these results.
    history.replaceState(null, '', '#/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
    show(q);
  }, 140);
  input.addEventListener('input', () => sync(input.value.trim()));

  await show(start);
  const form = h('form', { class: 'search search--page', role: 'search', onsubmit: (e) => { e.preventDefault(); input.blur(); } }, input);
  if (!start) requestAnimationFrame(() => input.focus({ preventScroll: true }));

  return {
    crumbs: [HOME, { label: 'Search' }],
    hideFoot: true,
    node: spread({ kicker: 'Home', title: 'Search', extra: null }, h('div', null, form, results)),
  };
}
