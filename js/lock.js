// Optional privacy lock.
//
// V1 is a passcode screen: it keeps the index out of sight, it does not
// encrypt what is stored. The passcode itself is only kept as a salted hash.
// A native build can replace `passcodeProvider` with Face ID / Touch ID.

import { prefs } from './storage/index.js';

const KEY = 'lock';
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(passcode, saltHex, iterations) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

const passcodeProvider = {
  available: () => !!globalThis.crypto?.subtle,
  async enrol(passcode) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const iterations = 150000;
    return { salt, iterations, hash: await derive(passcode, salt, iterations) };
  },
  async verify(passcode, secret) {
    return (await derive(passcode, secret.salt, secret.iterations)) === secret.hash;
  },
};

export const lock = {
  provider: passcodeProvider,
  available() { return this.provider.available(); },
  settings() { return prefs.get(KEY, null); },
  isEnabled() { return !!this.settings()?.secret; },
  timeout() { return Number(this.settings()?.timeout ?? 0); },
  async enable(passcode) {
    prefs.set(KEY, { secret: await this.provider.enrol(passcode), timeout: this.timeout() });
  },
  setTimeoutSeconds(seconds) {
    const s = this.settings();
    if (s) prefs.set(KEY, { ...s, timeout: Number(seconds) });
  },
  disable() { prefs.remove(KEY); },
  async verify(passcode) {
    const s = this.settings();
    return s?.secret ? this.provider.verify(passcode, s.secret) : true;
  },
};
