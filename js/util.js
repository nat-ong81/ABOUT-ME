export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Dates are stored as plain 'YYYY-MM-DD' strings and always read as local dates.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => toISO(new Date());

export function parseISO(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addInterval(iso, n, unit) {
  const d = parseISO(iso);
  n = Number(n);
  if (!d || !n) return '';
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'week') d.setDate(d.getDate() + n * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + (unit === 'year' ? n * 12 : n));
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return toISO(d);
}

export function daysBetween(fromISO, toISOdate) {
  const a = parseISO(fromISO), b = parseISO(toISOdate);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

export const pad2 = (n) => String(n).padStart(2, '0');

export function fmtDate(iso) {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}
export function fmtShort(iso) {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : '';
}
export function fmtDayMonth(iso) {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` : '';
}

export function debounce(fn, ms = 160) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

// Only http(s) links are ever rendered as links.
export function safeUrl(value) {
  let v = (value || '').trim();
  if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
}
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function fmtBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export const byText = (get) => (a, b) => get(a).localeCompare(get(b), undefined, { sensitivity: 'base' });
