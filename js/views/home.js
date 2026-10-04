import { h } from '../ui/dom.js';
import { db } from '../storage/index.js';
import { SECTIONS } from '../config.js';
import { refresh } from '../router.js';
import { remindersFrom } from '../domain/reminders.js';
import { addFile, removeFile, fileMeta } from '../attachments.js';
import { picture, searchPill, toast } from '../ui/components.js';
import { fmtDayMonth } from '../util.js';

const PHOTO_ID = 'profile-photo'; // one fixed file, so it travels with backups

export async function home() {
  const reminders = remindersFrom(await db.all('records'));
  const next = reminders.find((r) => r.status === 'upcoming');
  const overdue = reminders.filter((r) => r.status === 'overdue').length;
  const hasPhoto = !!(await fileMeta(PHOTO_ID));

  const input = h('input', { class: 'visually-hidden', type: 'file', accept: 'image/*' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      await removeFile(PHOTO_ID);
      await addFile(file, { id: PHOTO_ID });
      refresh();
    } catch (err) {
      console.error(err);
      toast('That photo could not be saved on this device.');
    }
  });

  const node = h('div', { class: 'home' },
    h('h1', { class: 'home__title' }, 'About me'),
    h('label', { class: 'avatar', 'aria-label': hasPhoto ? 'Change photo' : 'Upload photo' }, input,
      hasPhoto ? picture(PHOTO_ID, { thumb: true, alt: 'My photo' }) : h('span', null, 'Upload', h('br'), 'photo')),
    h('nav', { class: 'bars', 'aria-label': 'Sections' },
      SECTIONS.map((s) => h('a', { class: 'bar', href: `#/${s.id}` }, `${Number(s.no)}. ${s.name}`))),
    searchPill(),
    h('a', { class: 'upcoming', href: '#/reminders' },
      h('span', { class: 'label' }, 'Upcoming'),
      h('span', { class: 'upcoming__row' },
        h('span', null, next ? `${next.title}, ${fmtDayMonth(next.due)}` : 'Nothing upcoming'),
        overdue ? h('span', { class: 'upcoming__overdue' }, `${overdue} overdue`) : null)),
  );

  return { crumbs: [], node };
}
