# About Me (formerly Index of Me)

A private personal index: health and appointment records, reference details,
a product library, a small inventory and the reminders that follow from them.

Plain HTML, CSS and JavaScript modules. No build step, no dependencies, no
account, no network calls. Everything is stored on the device.

## Run it

Any static web server works. From this folder:

    python3 -m http.server 8080

then open http://localhost:8080. (Opening `index.html` straight from disk does
not work: browsers block modules, the service worker and file storage there.)

## Put it on an iPhone

The app has to be served over **https** to be installable and to store data.

1. Upload this folder, as it is, to any static host: GitHub Pages, Netlify,
   Cloudflare Pages or your own server. Sub-folders are fine; all paths are
   relative.
2. Open the address in **Safari** on the iPhone.
3. Share, then **Add to Home Screen**.

It then opens full screen and works offline. Data belongs to that installed
app on that phone; the desktop browser has its own separate index. Move data
between them with Settings, Export / Import.

Because the pages are public files with no data in them, hosting them does not
expose anything personal. Your entries never leave the device.

## What is where

    index.html              shell: breadcrumb bar, page outlet
    manifest.webmanifest    install metadata
    sw.js                   offline cache of the app's own files
    css/styles.css          all styling, design tokens at the top
    js/
      app.js                start-up, routes, privacy lock wiring
      router.js             hash router: #/care/skincare/<id>
      config.js             record types, categories, statuses, Me sections
      attachments.js        photo intake: resize, thumbnail, object URLs
      lock.js               optional passcode lock
      platform.js           PWA / native detection, native feature stubs
      storage/
        index.js            chooses the three back-ends (swap point)
        db.js               1. structured data   IndexedDB
        files.js            2. photos, documents OPFS, then Cache Storage
        prefs.js            3. settings          localStorage
        backup.js           JSON export / import
      domain/               rules with no DOM: reminders, search, naming
      ui/                   element helper, shared components, lock screen
      views/                one module per section

## Storage

Three separate layers, each behind a small interface:

| Layer | Holds | Now | Native later |
| --- | --- | --- | --- |
| `db` | records, Me entries, products, inventory, file metadata | IndexedDB | SQLite or a JSON file |
| `files` | photo and document bytes, keyed by id | Origin Private File System; Cache Storage if OPFS cannot be written | Capacitor Filesystem |
| `prefs` | theme, lock settings, last backup date | localStorage | Capacitor Preferences |

No image bytes are stored in IndexedDB. An entry holds `fileIds`; the `files`
table holds one small metadata row per file; the bytes live in the file store
under the same id (plus `<id>.thumb` for the list thumbnail). Photos are
resized to 2000 px on the long edge when added.

Only `js/storage/index.js` knows which back-end is in use. To move to native
storage, write three classes with the same methods and construct them there.

### Data shapes

    record     { id, type, customType, date, provider, notes, fileIds[],
                 reminder: { repeat, every, unit, due, note, done, doneAt, doneBy } | null }
    me entry   { id, group, data: { ... }, pairs: [{ label, value }], fileIds[] }
    group      { id, name }                      custom Me sections only
    product    { id, brand, name, category, shade, notes, favourite, url, fileIds[] }
    inventory  { id, productId | null, name, status, archived, fileIds[] }
    file       { id, name, type, size, kind, thumb, width, height }

Dates are `YYYY-MM-DD` strings. Every row also has `createdAt` / `updatedAt`.

## Added in 1.3

- Back arrow fixed at the bottom left of every page except home.
- Prescriptions show one at a time in a swipeable pager (`pager()` in `js/ui/components.js`).
- Medication entries have `use` and a `prices: [{ place, price, date }]` comparison list.
- Creating a custom Profile section opens its first entry form straight away.
- Products have a `price`. Inventory items have `qty` and `expiry`; items that
  expire within six months are added to the reminders (`expiryReminders` in
  `js/domain/reminders.js`) and to "Upcoming" on the home page.

## Reminders

Reminders are not entered separately. A record carries an optional reminder
(one time, monthly, every 3 or 6 months, yearly, or a custom interval) and the
timeline under 05 is computed from the records each time it opens.

- The due date is the record date plus the interval, and can be overridden.
- Saving a new record closes any open reminder on an earlier record of the
  same type. "Log this visit" on a record starts that new record pre-filled.
- A reminder can also be marked done by hand.

There are no push notifications in V1. An installed iOS web app cannot schedule
local notifications by itself; that arrives with the native build.

## Backup

Settings, Backup:

- **Export data** writes one readable JSON file with every entry.
- **Export data with photos** adds the photo bytes to the same file.
- **Import a backup** merges: new entries are added, entries with the same id
  are replaced by the backup's version.

Export regularly. Browser storage can be cleared by the user, and Safari may
clear data for sites that are not installed to the Home Screen.

## Privacy

- A Content-Security-Policy in `index.html` limits the app to its own files, so
  it cannot load from or send to another server.
- The optional privacy lock asks for a passcode on launch and after the app
  has been in the background. It is a screen lock: stored data is not
  encrypted in V1. The passcode is kept only as a salted PBKDF2 hash.

## Design

Four greys (`#f0f0f0`, `#d9d9d9`, `#b5b5b5`, `#202020`), flipped for dark mode.
Headers are Gill Sans SemiBold with tracking 100; body text is Avenir Book
with tracking 80. Both ship with iOS and macOS, so no font files are bundled;
other systems fall back to their own sans-serif. Sizes are taken from the
924px-wide mockups and scaled to a 390px phone. All of it is defined in the
`:root` block at the top of `css/styles.css`.

Section names and order: 1 Profile, 2 Health, 3 Self-care, 4 Inventory,
5 Reminders (`SECTIONS` in `js/config.js`).

## Changing the app

- New record type, product category or built-in Me section: `js/config.js`.
- Colours, type sizes, spacing: the `:root` block in `css/styles.css`.
- After changing any file, raise `VERSION` in `sw.js` so installed copies
  pick up the new files. If you add a file, add it to `ASSETS` there too.

## Packaging with Capacitor later

The app is already a static web folder with relative paths and hash routing,
which is what Capacitor's `webDir` expects.

1. `npm init`, add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`.
2. Point `webDir` at this folder and run `npx cap add ios`.
3. Replace the three back-ends in `js/storage/index.js` with Filesystem,
   Preferences and (optionally) SQLite implementations.
4. Fill in `js/platform.js`: Face ID for `lock.js`, local notifications fed
   from `domain/reminders.js`, the native camera for `attachments.js`.
5. Skip service-worker registration when `platform.native` is true.

## Tested

Automated runs in Chromium at phone and desktop sizes cover every page, forms,
photo intake, reminder rules, search, backup round-trip, the lock, offline
loading and both photo-storage fall-backs. It has not yet been run on a
physical iPhone; Safari-specific paths (camera roll picker, Home Screen
install, OPFS writes through the worker) are written to the documented
behaviour and should be checked on the device.
