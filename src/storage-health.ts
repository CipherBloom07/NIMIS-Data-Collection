/** User-facing storage diagnostics. Quota values are browser estimates, not a guaranteed capacity. */
import { countOperations, getPhotoStoreSummary, listDrafts } from './storage';

export type StorageRisk = 'unknown' | 'healthy' | 'warning' | 'critical';
export type StorageHealth = {
  supported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  freeBytes: number | null;
  usageRatio: number | null;
  persisted: boolean | null;
  risk: StorageRisk;
  draftCount: number;
  photoCount: number;
  photoBytes: number;
  operationCount: number;
};

const MEGABYTE = 1024 * 1024;

export function classifyStorageRisk(freeBytes: number | null, quotaBytes: number | null): StorageRisk {
  if (freeBytes === null || quotaBytes === null || quotaBytes <= 0) return 'unknown';
  const fraction = freeBytes / quotaBytes;
  if (freeBytes < 25 * MEGABYTE || fraction < 0.05) return 'critical';
  if (freeBytes < 100 * MEGABYTE || fraction < 0.10) return 'warning';
  return 'healthy';
}

export function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return 'Unavailable';
  if (value < 1024) return Math.round(value) + ' B';
  if (value < MEGABYTE) return (value / 1024).toFixed(1) + ' KB';
  if (value < 1024 * MEGABYTE) return (value / MEGABYTE).toFixed(1) + ' MB';
  return (value / (1024 * MEGABYTE)).toFixed(2) + ' GB';
}

/** Cheap quota-only check for an always-visible low-storage warning. */
export async function quickStorageRisk(): Promise<StorageRisk> {
  if (!navigator.storage?.estimate) return 'unknown';
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage;
    const quota = estimate.quota;
    if (typeof usage !== 'number' || typeof quota !== 'number' ||
        !Number.isFinite(usage) || !Number.isFinite(quota)) return 'unknown';
    return classifyStorageRisk(Math.max(0, quota - usage), quota);
  } catch { return 'unknown'; }
}

export async function readStorageHealth(): Promise<StorageHealth> {
  const [drafts, photoSummary, operationCount] = await Promise.all([
    listDrafts(), getPhotoStoreSummary(), countOperations(),
  ]);
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  let persisted: boolean | null = null;
  const supported = !!navigator.storage?.estimate;
  if (supported) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === 'number' && Number.isFinite(estimate.usage)) usageBytes = estimate.usage;
      if (typeof estimate.quota === 'number' && Number.isFinite(estimate.quota)) quotaBytes = estimate.quota;
    } catch { /* Estimated quota may be unavailable in private mode. */ }
  }
  if (navigator.storage?.persisted) {
    try { persisted = await navigator.storage.persisted(); } catch { /* Browser did not expose persistence state. */ }
  }
  const freeBytes = quotaBytes !== null && usageBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null;
  return {
    supported, usageBytes, quotaBytes, freeBytes,
    usageRatio: usageBytes !== null && quotaBytes !== null && quotaBytes > 0 ? Math.min(1, usageBytes / quotaBytes) : null,
    persisted, risk: classifyStorageRisk(freeBytes, quotaBytes),
    draftCount: drafts.length, photoCount: photoSummary.count,
    photoBytes: photoSummary.bytes, operationCount,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) throw new Error('This browser does not support persistent storage requests.');
  return navigator.storage.persist();
}
