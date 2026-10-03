import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { SECTIONS } from '../config.js';
import { navigate } from '../router.js';
import { remindersFrom } from '../domain/reminders.js';
import { fmtDayMonth, fmtShort, parseISO, plural } from '../util.js';

export async function home() {
  const [records, me, products, inventory] = await Promise.all(
    ['records', 'me', 'products', 'inventory'].map((s) => db.all(s)),
  );
  const reminders = remindersFrom(records);
  const open = reminders.filter((r) => r.status !== 'done');
  const next = reminders.find((r) => r.status === 'upcoming');
  const overdue = reminders.filter((r) => r.status === 'overdue').length;

  const counts = {
    records: records.length,
    me: me.length,
    care: products.length,
    inventory: inventory.filter((i) => !i.archived).length,
    reminders: open.length,
  };

  const q = h('input', {
    class: 'search__input', type: 'search', name: 'q', placeholder: 'Search my index…',
    'aria-label': 'Search my index', autocomplete: 'off', autocapitalize: 'off', enterkeyhint: 'search',
  });
  const search = h('form', {
    class: 'search', role: 'search',
    onsubmit: (e) => {
      e.preventDefault();
      navigate('search' + (q.value.trim() ? '?q=' + encodeURIComponent(q.value.trim()) : ''));
    },
  }, q);

  const thisYear = new Date().getFullYear();
  const nextLine = h('a', { class: 'next', href: '#/reminders' },
    h('span', { class: 'label' }, 'Next'),
    next
      ? h('span', { class: 'next__body' },
        h('span', { class: 'next__date' }, parseISO(next.due).getFullYear() === thisYear ? fmtDayMonth(next.due) : fmtShort(next.due)),
        h('span', { class: 'next__title' }, next.title),
        next.note && h('span', { class: 'next__note' }, next.note))
      : h('span', { class: 'next__body' }, h('span', { class: 'next__note' }, 'Nothing upcoming')),
    overdue ? h('span', { class: 'next__overdue' }, `${overdue} overdue`) : null);

  const node = h('div', { class: 'home' },
    h('div', { class: 'home__lead' },
      h('h1', { class: 'home__title' }, 'My Index'),
      h('div', { class: 'home__tools' }, search, nextLine)),
    h('nav', { class: 'index', 'aria-label': 'Sections' },
      SECTIONS.map((s) => h('a', { class: 'index__row', href: `#/${s.id}` },
        h('span', { class: 'index__no' }, s.no),
        h('span', { class: 'index__name' }, s.name),
        h('span', { class: 'index__count', 'aria-label': plural(counts[s.id], 'entry', 'entries') }, counts[s.id] ? String(counts[s.id]) : '')))),
    h('p', { class: 'home__foot' },
      'Kept on this device only. ',
      h('a', { href: '#/settings' }, 'Settings and backup')),
  );

  return { crumbs: [], node, title: 'My Index' };
}
