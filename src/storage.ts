import { schemaVersion } from './survey';

export type Answer = string | string[] | number | null | { latitude: number; longitude: number; accuracy_m: number; captured_at: string };
export type SurveyAnswers = Record<string, Answer>;
export type Draft = { id: string; answers: SurveyAnswers; revision: number; updatedAt: string; status: 'local_pending' };
export type OutboxEvent = { id: string; surveyId: string; revision: number; createdAt: string; schemaVersion: number; answers: SurveyAnswers };
const DB_NAME = 'nimis_field_pwa_v1';
const DB_VERSION = 1;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'surveyId' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
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
      const req = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
      req.onsuccess = () => resolve(req.result as OutboxEvent[]);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function saveDraft(id: string | null, answers: SurveyAnswers): Promise<Draft> {
  const db = await openDatabase();
  const draftId = id ?? crypto.randomUUID();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts','outbox'], 'readwrite');
      let result: Draft | undefined;
      const get = tx.objectStore('drafts').get(draftId);
      get.onsuccess = () => {
        const old = get.result as Draft | undefined;
        const revision = (old?.revision ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        result = { id: draftId, answers: structuredClone(answers), revision, updatedAt, status: 'local_pending' };
        const event: OutboxEvent = { id: draftId + ':' + revision, surveyId: draftId,
          revision, createdAt: updatedAt, schemaVersion, answers: structuredClone(answers) };
        tx.objectStore('drafts').put(result);
        // Latest edit replaces the earlier unsent event atomically.
        tx.objectStore('outbox').put(event);
      };
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => resolve(result!);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Save interrupted'));
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
