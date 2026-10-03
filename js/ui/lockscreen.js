import { h } from './dom.js';
import { lock } from '../lock.js';
import { eraseEverything } from '../storage/index.js';
import { confirmDialog } from './components.js';

// Covers the app until the passcode is entered. Resolves once unlocked.
export function lockScreen() {
  return new Promise((resolve) => {
    document.body.classList.add('is-locked');
    const code = h('input', {
      class: 'input lock__input', type: 'password', inputmode: 'numeric', autocomplete: 'off',
      'aria-label': 'Passcode', placeholder: 'Passcode',
    });
    const msg = h('p', { class: 'form__error lock__msg', role: 'alert' });
    let busy = false;

    const form = h('form', { class: 'lock__form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (busy || !code.value) return;
      busy = true;
      const ok = await lock.verify(code.value).catch(() => false);
      busy = false;
      if (!ok) { msg.textContent = 'That passcode does not match.'; code.value = ''; code.focus(); return; }
      screen.remove();
      document.body.classList.remove('is-locked');
      resolve();
    } }, code, h('button', { class: 'btn btn--solid', type: 'submit' }, 'Unlock'), msg);

    const screen = h('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Index of Me is locked' },
      h('p', { class: 'label' }, 'Index of Me'),
      h('h1', { class: 'title lock__title' }, 'Locked'),
      form,
      h('button', { class: 'act act--quiet lock__forgot', type: 'button', onclick: async () => {
        const ok = await confirmDialog({
          title: 'Forgotten the passcode?',
          body: 'The only way back in is to erase everything stored on this device, then restore from a backup if you have one.',
          confirm: 'Erase everything',
        });
        if (!ok) return;
        await eraseEverything();
        location.hash = '#/';
        location.reload();
      } }, 'Forgotten passcode'));

    document.body.append(screen);
    requestAnimationFrame(() => code.focus());
  });
}
