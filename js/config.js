// Static definitions for the app. Editing this file is the way to add
// record types, product categories or built-in "Me" sections.

export const APP = {
  id: 'index-of-me',
  name: 'About Me',
  version: '1.3.0',
  schema: 1,
};

export const SECTIONS = [
  { no: '01', id: 'me', name: 'Profile' },
  { no: '02', id: 'records', name: 'Health' },
  { no: '03', id: 'care', name: 'Self-care' },
  { no: '04', id: 'inventory', name: 'Inventory' },
  { no: '05', id: 'reminders', name: 'Reminders' },
];

// `keywords` are only used by search, so that "dentist" finds dental visits.
export const RECORD_TYPES = [
  { id: 'medical', name: 'Medical appointment', keywords: 'doctor gp physician clinic check-up checkup consultation' },
  { id: 'dental', name: 'Dental visit', keywords: 'dentist dental teeth hygienist cleaning scaling' },
  { id: 'pap', name: 'Pap smear', keywords: 'cervical screening smear gynaecologist gynecologist' },
  { id: 'eye', name: 'Eye examination', keywords: 'optometrist optician ophthalmologist eyes vision eye test' },
  { id: 'blood', name: 'Blood test', keywords: 'bloods lab laboratory panel' },
  { id: 'vaccination', name: 'Vaccination', keywords: 'vaccine jab shot immunisation immunization booster' },
  { id: 'other', name: 'Other', keywords: '' },
];

export const REPEATS = [
  { id: 'none', name: 'No reminder' },
  { id: 'once', name: 'One time' },
  { id: 'monthly', name: 'Monthly', every: 1, unit: 'month' },
  { id: 'quarterly', name: 'Every 3 months', every: 3, unit: 'month' },
  { id: 'halfyearly', name: 'Every 6 months', every: 6, unit: 'month' },
  { id: 'yearly', name: 'Yearly', every: 1, unit: 'year' },
  { id: 'custom', name: 'Custom interval' },
];

export const INTERVAL_UNITS = [
  { id: 'day', name: 'days' },
  { id: 'week', name: 'weeks' },
  { id: 'month', name: 'months' },
  { id: 'year', name: 'years' },
];

export const CARE_CATEGORIES = [
  { id: 'skincare', name: 'Skincare' },
  { id: 'makeup', name: 'Makeup' },
  { id: 'haircare', name: 'Haircare' },
  { id: 'bodycare', name: 'Bodycare' },
  { id: 'fragrance', name: 'Fragrance' },
  { id: 'other', name: 'Other' },
];

export const INVENTORY_STATUSES = [
  { id: 'unopened', name: 'Unopened' },
  { id: 'open', name: 'Open' },
  { id: 'nearly-empty', name: 'Nearly empty' },
  { id: 'finished', name: 'Finished' },
];

// Built-in "Me" sections. Custom sections live in the `groups` store and use
// free label / value pairs instead of a fixed field list.
export const ME_GROUPS = [
  {
    id: 'eyes',
    name: 'Eyes',
    item: 'Glasses prescription',
    layout: 'rx',
    photos: true,
    fields: [
      { key: 'pd', label: 'PD', placeholder: '62' },
      { key: 'issued', label: 'Date issued', type: 'date' },
      { key: 'optometrist', label: 'Optometrist' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'medication',
    name: 'Medication',
    item: 'Medication',
    titleKey: 'name',
    prices: true,
    fields: [
      { key: 'name', label: 'Medication name', required: true },
      { key: 'use', label: 'Use', placeholder: 'What it is for' },
      { key: 'dosage', label: 'Dosage', placeholder: '10 mg' },
      { key: 'frequency', label: 'Frequency', placeholder: 'Once daily' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'allergies',
    name: 'Allergies & sensitivities',
    item: 'Allergy or sensitivity',
    titleKey: 'item',
    fields: [
      { key: 'item', label: 'Item', required: true },
      { key: 'reaction', label: 'Reaction / notes', type: 'textarea' },
    ],
  },
];

export const RX_EYES = [
  { id: 'os', name: 'Left', hint: 'OS' },
  { id: 'od', name: 'Right', hint: 'OD' },
];
export const RX_COLUMNS = [
  { id: 'Sph', name: 'Sphere', placeholder: '-2.25' },
  { id: 'Cyl', name: 'Cylinder', placeholder: '-0.50' },
  { id: 'Axis', name: 'Axis', placeholder: '180' },
];

export const AUTOLOCK = [
  { id: '0', name: 'Immediately' },
  { id: '60', name: 'After 1 minute' },
  { id: '300', name: 'After 5 minutes' },
];
