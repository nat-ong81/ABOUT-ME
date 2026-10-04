// What the app is running in. Native-only features hang off this object so
// views never have to ask "am I in Capacitor?" themselves.

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const native = !!globalThis.Capacitor?.isNativePlatform?.();

export const platform = {
  standalone,
  native,
  // Placeholders for the native build. Each returns false / does nothing in the PWA.
  biometrics: { available: async () => false },
  notifications: { available: async () => false, schedule: async () => false },
};
