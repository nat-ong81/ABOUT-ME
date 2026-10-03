// 3 / 3 — PREFERENCES
// A handful of small settings (theme, privacy lock, last backup date).
// Maps directly onto the Capacitor Preferences plugin later on.

export class LocalPrefs {
  constructor(prefix = 'iom.') {
    this.prefix = prefix;
    this.kind = 'localstorage';
    this.memory = new Map(); // used when localStorage is blocked
  }
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw == null ? (this.memory.has(key) ? this.memory.get(key) : fallback) : JSON.parse(raw);
    } catch {
      return this.memory.has(key) ? this.memory.get(key) : fallback;
    }
  }
  set(key, value) {
    this.memory.set(key, value);
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch { /* memory only */ }
  }
  remove(key) {
    this.memory.delete(key);
    try { localStorage.removeItem(this.prefix + key); } catch { /* ignore */ }
  }
  clear() {
    this.memory.clear();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}
