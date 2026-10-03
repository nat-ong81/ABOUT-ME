import { prefs } from './storage/index.js';

export const THEMES = [
  { id: 'auto', name: 'Automatic' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export const currentTheme = () => prefs.get('theme', 'auto');

export function applyTheme(theme = currentTheme()) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export function setTheme(theme) {
  prefs.set('theme', theme);
  applyTheme(theme);
}
