import type { SurveyAnswers } from './storage';
import { validateBaseline } from './validation';

/** These fabricated identities and numbers are not actual Ministry information. */
export type DemoCase = { id: string; label: string; expectedErrors: number; expectedWarnings: number; answers: SurveyAnswers };
const base: SurveyAnswers = {
  site_name: '[TEST] Fictional Demonstration Site',
  scheme_name: '[TEST ONLY] Fictional Irrigation Scheme',
  province: 'Masvingo',
  district: 'DEMO DISTRICT (FICTIONAL)',
  ward: 'DEMO WARD',
  scheme_photo: 'SIMULATED-PHOTO-NOT-A-REAL-ATTACHMENT',
  scheme_gps: { latitude: -20.1, longitude: 30.9, accuracy_m: 8, captured_at: '2026-11-23T10:00:00+02:00' },
  equipped_area_ha: 80,
  functional_area_ha: 65,
  expansion_area_ha: 20,
  beneficiaries: 92,
  commissioned_year: 2017,
  scheme_status: 'Partially functional',
  water_source_type: 'Dam',
  irrigation_system: 'Gravity-fed canals',
  energy_source: 'Gravity',
};
export const demoCases: DemoCase[] = [
  { id: 'DEMO-VALID', label: 'Valid fictional baseline', expectedErrors: 0, expectedWarnings: 0,
    answers: { ...base } },
  { id: 'DEMO-INVALID', label: 'Invalid area and out-of-country GPS', expectedErrors: 3, expectedWarnings: 1,
    answers: { ...base, scheme_name: '[TEST ONLY] Invalid Scheme',
      equipped_area_ha: -4, functional_area_ha: -2,
      scheme_gps: { latitude: -10, longitude: 39, accuracy_m: 8, captured_at: '2026-11-23T10:00:00+02:00' } } },
  { id: 'DEMO-WARNING', label: 'Area consistency warning', expectedErrors: 0, expectedWarnings: 1,
    answers: { ...base, scheme_name: '[TEST ONLY] Area Discrepancy',
      equipped_area_ha: 50, functional_area_ha: 65, scheme_status: 'Fully functional' } },
];
export type DemoResult = { id: string; label: string; actualErrors: number; actualWarnings: number;
  expectedErrors: number; expectedWarnings: number; passed: boolean; details: string[] };
export function runDataChecks(): DemoResult[] {
  return demoCases.map(item => {
    const issues = validateBaseline(item.answers, 2026);
    const actualErrors = issues.filter(issue => issue.severity === 'error').length;
    const actualWarnings = issues.filter(issue => issue.severity === 'warning').length;
    return { id: item.id, label: item.label, actualErrors, actualWarnings,
      expectedErrors: item.expectedErrors, expectedWarnings: item.expectedWarnings,
      passed: actualErrors === item.expectedErrors && actualWarnings === item.expectedWarnings,
      details: issues.map(issue => issue.severity.toUpperCase() + ': ' + issue.message) };
  });
}

const DB_NAME = 'nimis_fictional_data_test_v1'; // MUST remain separate from survey IndexedDB.
const STORE = 'cases';
function openDemoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function storeTestData(): Promise<void> {
  const db = await openDemoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      for (const item of demoCases) tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Test storage transaction aborted'));
    });
  } finally { db.close(); }
}
export async function readTestData(): Promise<DemoCase[]> {
  const db = await openDemoDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as DemoCase[]);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}
export async function clearTestData(): Promise<void> {
  const db = await openDemoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Test storage clearing aborted'));
    });
  } finally { db.close(); }
}
