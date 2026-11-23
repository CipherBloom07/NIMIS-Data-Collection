import { allFields, schemaVersion, sections, type SurveySection } from './survey';

export type VersionedFormDefinition = {
  form_id: string;
  form_version: number;
  title: string;
  sections: SurveySection[];
  issued_at?: string;
  accepted_until?: string | null;
  source: 'bundled' | 'server';
};

export type ReferenceBundle = {
  revision: string;
  generated_at: string;
  provinces: string[];
  district_wards: Record<string, string[]>;
  picklists: Record<string, string[]>;
};

/** Bundled fallback is always available before first online enrolment. */
export const bundledBaseline: VersionedFormDefinition = {
  form_id: 'scheme_baseline',
  form_version: schemaVersion,
  title: 'Scheme Baseline Survey',
  sections,
  source: 'bundled',
};

export function validateFormDefinition(candidate: unknown): candidate is VersionedFormDefinition {
  if (!candidate || typeof candidate !== 'object') return false;
  const form = candidate as Partial<VersionedFormDefinition>;
  if (typeof form.form_id !== 'string' || !/^[a-z0-9_-]{2,80}$/.test(form.form_id)) return false;
  if (!Number.isSafeInteger(form.form_version) || (form.form_version ?? 0) < 1) return false;
  if (typeof form.title !== 'string' || !Array.isArray(form.sections)) return false;
  const keys = new Set<string>();
  for (const section of form.sections) {
    if (!section || typeof section.name !== 'string' || !Array.isArray(section.fields)) return false;
    for (const field of section.fields) {
      if (!field || typeof field.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)
        || typeof field.label !== 'string' || typeof field.type !== 'string'
        || !['text','number','select','multi','gps','photo'].includes(field.type)
        || keys.has(field.key)) return false;
      if ((field.type === 'select' || field.type === 'multi')
        && (!Array.isArray(field.options) || field.options.some(option => typeof option !== 'string'))) return false;
      keys.add(field.key);
    }
  }
  return form.sections.length > 0 && keys.size > 0;
}

export function validateReferenceBundle(candidate: unknown): candidate is ReferenceBundle {
  if (!candidate || typeof candidate !== 'object') return false;
  const bundle = candidate as Partial<ReferenceBundle>;
  return typeof bundle.revision === 'string'
    && typeof bundle.generated_at === 'string'
    && Array.isArray(bundle.provinces)
    && bundle.provinces.every(value => typeof value === 'string')
    && !!bundle.district_wards && typeof bundle.district_wards === 'object'
    && !!bundle.picklists && typeof bundle.picklists === 'object';
}

const FORM_KEY = (formId: string, version: number) => formId + ':' + version;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('nimis_form_cache_v1', 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('forms')) db.createObjectStore('forms', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('reference')) db.createObjectStore('reference', { keyPath: 'revision' });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
}

export async function cacheFormDefinition(form: VersionedFormDefinition): Promise<void> {
  if (!validateFormDefinition(form)) throw new Error('Invalid form definition');
  const db = await getDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('forms','readwrite');
      tx.objectStore('forms').put({ ...form, key: FORM_KEY(form.form_id, form.form_version) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Form cache write aborted'));
    });
  } finally { db.close(); }
}

export async function getFormDefinition(formId: string, version: number): Promise<VersionedFormDefinition | null> {
  if (formId === bundledBaseline.form_id && version === bundledBaseline.form_version) {
    // Do not silently upgrade an already started draft to a later form version.
    return bundledBaseline;
  }
  const db = await getDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('forms','readonly').objectStore('forms').get(FORM_KEY(formId,version));
      req.onsuccess = () => resolve((req.result as VersionedFormDefinition | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function cacheReferenceBundle(bundle: ReferenceBundle): Promise<void> {
  if (!validateReferenceBundle(bundle)) throw new Error('Invalid reference bundle');
  const db = await getDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('reference', 'readwrite');
      tx.objectStore('reference').put(bundle);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Reference cache write aborted'));
    });
  } finally { db.close(); }
}

export function requiredBaselineKeys(): string[] {
  return allFields.filter(field => field.required).map(field => field.key);
}
