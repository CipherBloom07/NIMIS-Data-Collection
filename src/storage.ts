import { schemaVersion } from './survey';

export type Answer = string | string[] | number | null | { latitude: number; longitude: number; accuracy_m: number; captured_at: string };
export type SurveyAnswers = Record<string, Answer>;
export type Draft = { id: string; formId?: string; formVersion?: number; answers: SurveyAnswers; revision: number; updatedAt: string; status: 'local_pending' };
export type OutboxEvent = { id: string; surveyId: string; formId?: string; formVersion?: number; revision: number; createdAt: string; schemaVersion: number; answers: SurveyAnswers };
const DB_NAME = 'nimis_field_pwa_v1';
const DB_VERSION = 2;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'surveyId' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id' });
      }
      // Preserve and migrate any old one-event-per-survey outbox entries.
      if (db.objectStoreNames.contains('outbox')) {
        const old = req.transaction!.objectStore('outbox');
        const copy = old.getAll();
        copy.onsuccess = () => {
          const operations = req.transaction!.objectStore('operations');
          for (const entry of copy.result as OutboxEvent[]) {
            operations.put(entry);
          }
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts(): Promise<Draft[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
      req.onsuccess = () => resolve((req.result as Draft[]).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function listOutbox(): Promise<OutboxEvent[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('operations', 'readonly').objectStore('operations').getAll();
      req.onsuccess = () => resolve((req.result as OutboxEvent[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.revision - b.revision));
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function saveDraft(id: string | null, answers: SurveyAnswers, recordOperation = true): Promise<Draft> {
  const db = await openDatabase();
  const draftId = id ?? crypto.randomUUID();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(recordOperation ? ['drafts','operations'] : ['drafts'], 'readwrite');
      let result: Draft | undefined;
      const get = tx.objectStore('drafts').get(draftId);
      get.onsuccess = () => {
        const old = get.result as Draft | undefined;
        const revision = (old?.revision ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        // Existing drafts remain pinned to the form version they started on.
        const formId = old?.formId ?? 'scheme_baseline';
        const formVersion = old?.formVersion ?? schemaVersion;
        result = { id: draftId, formId, formVersion, answers: structuredClone(answers), revision, updatedAt, status: 'local_pending' };
        const event: OutboxEvent = { id: draftId + ':' + revision, surveyId: draftId, formId, formVersion,
          revision, createdAt: updatedAt, schemaVersion: formVersion, answers: structuredClone(answers) };
        tx.objectStore('drafts').put(result);
        // Immutable event: each local revision is retained until acknowledged.
        if (recordOperation) tx.objectStore('operations').add(event);
      };
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => resolve(result!);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Save interrupted'));
    });
  } finally { db.close(); }
}

export async function countOperations(): Promise<number> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('operations', 'readonly').objectStore('operations').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

/** Uses a cursor rather than loading the entire photo collection into memory. */
export async function getPhotoStoreSummary(): Promise<{ count: number; bytes: number }> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('photos', 'readonly');
      const request = transaction.objectStore('photos').openCursor();
      let count = 0;
      let bytes = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve({ count, bytes }); return; }
        const row = cursor.value as { blob?: Blob };
        count += 1;
        bytes += row.blob instanceof Blob ? row.blob.size : 0;
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Photo summary interrupted'));
    });
  } finally { db.close(); }
}

export async function savePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Select an image file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Photo is larger than 12MB.');
  const id = crypto.randomUUID();
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').put({ id, filename: file.name, mime: file.type, blob: file });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function loadPhoto(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('photos', 'readonly').objectStore('photos').get(id);
      req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}
