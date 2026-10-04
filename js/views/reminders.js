import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { spread, act, filters, empty } from '../ui/components.js';
import { remindersFrom, dueInWords } from '../domain/reminders.js';
import { parseISO, MONTHS, pad2 } from '../util.js';

const HOME = { label: 'Home', href: '#/' };
const VIEWS = ['upcoming', 'overdue', 'all'];

export async function remindersPage({ query }) {
  const records = await db.all('records');
  const all = remindersFrom(records);
  const show = VIEWS.includes(query.show) ? query.show : 'upcoming';
  const count = (s) => all.filter((r) => r.status === s).length;
  const shown = show === 'all' ? all : all.filter((r) => r.status === show);
  const thisYear = new Date().getFullYear();

  const body = h('div', null, filters([
    { id: 'upcoming', name: 'Upcoming', href: '#/reminders', count: count('upcoming') || null },
    { id: 'overdue', name: 'Overdue', href: '#/reminders?show=overdue', count: count('overdue') || null },
    { id: 'all', name: 'All', href: '#/reminders?show=all' },
  ], show, { label: 'Show' }));

  if (!shown.length) {
    body.append(empty(
      show === 'overdue' ? 'Nothing is overdue.'
        : all.length ? 'Nothing upcoming.'
          : 'Reminders come from your records. Add a record, choose when it should come round again, and it appears here.',
      !all.length && act('Add a record', '#/records/new')));
  } else {
    let key = null, list = null;
    for (const r of shown) {
      const d = parseISO(r.due);
      const sameYear = d.getFullYear() === thisYear;
      const k = sameYear ? `m${d.getMonth()}` : `y${d.getFullYear()}`;
      if (k !== key) {
        key = k;
        list = h('ol', { class: 'timeline__list' });
        body.append(h('section', { class: 'timeline' },
          h('h2', { class: sameYear ? 'timeline__month label' : 'timeline__year' }, sameYear ? MONTHS[d.getMonth()] : String(d.getFullYear())),
          list));
      }
      list.append(h('li', null, h('a', { class: `timeline__row is-${r.status}`, href: `#/records/${r.recordId}` },
        h('span', { class: 'timeline__date' },
          sameYear
            ? h('span', { class: 'timeline__day' }, pad2(d.getDate()))
            : [h('span', { class: 'timeline__mon' }, MONTHS[d.getMonth()]), h('span', { class: 'timeline__dnum' }, pad2(d.getDate()))]),
        h('span', { class: 'timeline__main' },
          h('span', { class: 'timeline__title' }, r.title),
          r.note && h('span', { class: 'timeline__note' }, r.note)),
        h('span', { class: 'timeline__meta' }, r.status === 'done' ? 'Done' : r.status === 'overdue' ? dueInWords(r.due) : r.repeat))));
    }
  }

  return {
    crumbs: [HOME, { label: 'Reminders' }],
    node: spread({
      no: '05', title: 'Reminders',
      lede: 'What comes round next, drawn from my records.',
    }, body),
  };
}
