import { h } from '../ui/dom.js';
import { db, prefs, storageReport, requestPersistence, eraseEverything, STORES } from '../storage/index.js';
import { buildBackup, restoreBackup, deliver } from '../storage/backup.js';
import { resetFileCache } from '../attachments.js';
import { APP, AUTOLOCK } from '../config.js';
import { lock } from '../lock.js';
import { THEMES, currentTheme, setTheme } from '../theme.js';
import { navigate, refresh } from '../router.js';
import { spread, act, button, defs, field, input, select, sectionLabel, confirmDialog, toast } from '../ui/components.js';
import { fmtBytes, fmtDate, toISO, todayISO } from '../util.js';
import { platform } from '../platform.js';

const HOME = { label: 'My Index', href: '#/' };

export async function settingsPage() {
  const report = await storageReport();
  const total = (await Promise.all(STORES.filter((s) => s !== 'files').map((s) => db.all(s)))).reduce((n, rows) => n + rows.length, 0);
  const fileCount = (await db.all('files')).length;
  const lastBackup = prefs.get('lastBackup', null);

  // ---- where the data lives
  const device = h('section', { class: 'sheet__section' },
    sectionLabel('On this device'),
    h('p', { class: 'prose' }, 'Everything in your index is stored on this device, inside this browser or Home Screen app. There is no account, nothing is uploaded, and the app makes no connections to other servers.'),
    defs([
      ['Entries', `${total}, in the app’s local database`],
      ['Photos and documents', `${fileCount}, in ${report.files.charAt(0).toLowerCase() + report.files.slice(1)}`],
      ['Space used', report.usage != null ? fmtBytes(report.usage) : null],
      ['Protected from clean-up', report.persisted ? 'Yes' : h('span', null, 'Not yet. ', act('Ask the browser to keep it', async () => {
        const ok = await requestPersistence();
        toast(ok ? 'This index is now protected from automatic clean-up' : 'The browser did not grant this. Installing the app usually does.');
        refresh();
      }, { quiet: true }))],
    ]),
    !report.filesDurable && h('p', { class: 'notice' }, 'This browser is not allowing files to be saved, so photos added now will be lost when the page closes. Open the app over https, outside private browsing.'),
    !platform.standalone && h('p', { class: 'hint' }, 'On iPhone, open this page in Safari, tap Share, then Add to Home Screen. Installed, it opens full screen, works offline and its data is not cleared for inactivity.'));

  // ---- appearance
  const theme = currentTheme();
  const appearance = h('section', { class: 'sheet__section' },
    sectionLabel('Appearance'),
    h('div', { class: 'status status--loose', role: 'group', 'aria-label': 'Appearance' },
      THEMES.map((t) => h('button', { class: 'status__opt', type: 'button', 'aria-pressed': String(t.id === theme), onclick: () => { setTheme(t.id); refresh(); } }, t.name))));

  // ---- privacy lock
  const privacy = h('section', { class: 'sheet__section' }, sectionLabel('Privacy lock'));
  if (!lock.available()) {
    privacy.append(h('p', { class: 'hint' }, 'The lock needs a secure (https) connection.'));
  } else if (lock.isEnabled()) {
    const timeout = select(AUTOLOCK, String(lock.timeout()));
    timeout.addEventListener('change', () => { lock.setTimeoutSeconds(timeout.value); toast('Saved'); });
    privacy.append(
      h('p', { class: 'prose' }, 'A passcode is asked for when the app opens.'),
      field('Lock again after leaving the app', timeout),
      h('div', { class: 'inline-actions' },
        act('Lock now', () => window.dispatchEvent(new CustomEvent('iom:lock'))),
        act('Turn off', async () => {
          if (!(await confirmDialog({ title: 'Turn off the privacy lock?', confirm: 'Turn off' }))) return;
          lock.disable(); toast('Privacy lock turned off'); refresh();
        }, { quiet: true })));
  } else {
    const a = input({ type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxLength: 12, placeholder: '4 digits or more' });
    const b = input({ type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxLength: 12 });
    const err = h('p', { class: 'form__error', role: 'alert' });
    const form = h('form', { class: 'form form--inline', hidden: true, novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (a.value.length < 4) { err.textContent = 'Use at least 4 characters.'; return; }
      if (a.value !== b.value) { err.textContent = 'The two passcodes do not match.'; return; }
      await lock.enable(a.value);
      toast('Privacy lock turned on');
      refresh();
    } }, field('Passcode', a), field('Repeat passcode', b), err,
      h('div', { class: 'form__actions' }, button('Turn on lock', { solid: true, type: 'submit' })));
    const opener = act('Set a passcode', () => { form.hidden = false; opener.hidden = true; a.focus(); });
    privacy.append(
      h('p', { class: 'prose' }, 'Optional. Asks for a passcode when the app opens, to keep the index out of sight.'),
      h('p', { class: 'hint' }, 'It is a screen lock and does not encrypt what is stored. If the passcode is forgotten, the index has to be erased and restored from a backup.'),
      opener, form);
  }

  // ---- backup
  const stamp = todayISO();
  async function exportBackup(includeFiles) {
    try {
      const backup = await buildBackup({ includeFiles });
      const outcome = await deliver(`index-of-me-${stamp}${includeFiles ? '-with-photos' : ''}.json`, JSON.stringify(backup, null, includeFiles ? 0 : 2));
      if (outcome === 'cancelled') return;
      prefs.set('lastBackup', toISO(new Date()));
      toast('Backup exported');
      refresh();
    } catch (err) { console.error(err); toast('The backup could not be created.'); }
  }
  const importInput = h('input', { class: 'visually-hidden', type: 'file', accept: 'application/json,.json' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const n = STORES.filter((s) => s !== 'files').reduce((sum, s) => sum + (Array.isArray(backup?.data?.[s]) ? backup.data[s].length : 0), 0);
      const ok = await confirmDialog({
        title: 'Import this backup?',
        body: `It holds ${n} ${n === 1 ? 'entry' : 'entries'}${backup?.blobs ? ' with photos' : ', without photos'}. Entries already here are kept; ones with the same identity are replaced by the backup’s version.`,
        confirm: 'Import',
      });
      if (!ok) return;
      await restoreBackup(backup);
      resetFileCache();
      toast('Backup imported');
      refresh();
    } catch (err) {
      console.error(err);
      toast(err instanceof SyntaxError ? 'That file is not a readable backup.' : err.message || 'The backup could not be imported.');
    }
  });
  const backup = h('section', { class: 'sheet__section' },
    sectionLabel('Backup'),
    h('p', { class: 'prose' }, 'A backup is a single file you keep yourself, in Files or iCloud Drive for instance. Export one now and then, and before changing phone.'),
    lastBackup && h('p', { class: 'hint' }, `Last exported ${fmtDate(lastBackup)}.`),
    h('div', { class: 'stack-actions' },
      act('Export data', () => exportBackup(false)),
      act('Export data with photos', () => exportBackup(true)),
      h('label', { class: 'photos__add' }, importInput, h('span', { class: 'act' }, 'Import a backup'))),
    h('p', { class: 'hint' }, '“Export data” saves entries only and stays small. “With photos” also contains every photo and document, so the file is larger.'));

  // ---- erase
  const erase = h('section', { class: 'sheet__section' },
    sectionLabel('Erase'),
    act('Erase everything on this device', async () => {
      const ok = await confirmDialog({ title: 'Erase the whole index?', body: 'Every entry, photo and setting on this device is deleted. This cannot be undone.', confirm: 'Erase everything' });
      if (!ok) return;
      await eraseEverything();
      resetFileCache();
      toast('Index erased');
      navigate('', { replace: true });
    }, { quiet: true }));

  return {
    crumbs: [HOME, { label: 'Settings' }],
    node: spread({ kicker: 'My Index', title: 'Settings', lede: `Index of Me ${APP.version}` },
      h('div', { class: 'sheet' }, device, appearance, privacy, backup, erase)),
  };
}
