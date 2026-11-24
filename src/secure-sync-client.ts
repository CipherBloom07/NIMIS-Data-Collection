/**
 * NIMIS Collect staging adapter — explicit submission only.
 * This module does NOT read IndexedDB, transmit draft autosaves, store tokens,
 * mark photos synced, or delete outbox entries. Secure storage and enrolment
 * must be implemented before a real field device can use this.
 */
import type { OutboxEvent } from './storage';

export type SecurePushOutcome = 'accepted' | 'duplicate' | 'conflict' | 'rejected';
export interface SecurePushResult {
  event_id: string;
  outcome: SecurePushOutcome;
  received_at?: string;
  detail?: string;
}
export interface AssignedCollectorIdentity {
  /** UUID derived from the signed-in authoritative identity, never from form answers. */
  userId: string;
  /** UUID from authenticated enrolled device. */
  deviceId: string;
  /** Canonical, server-issued scheme ID from the user's assigned scheme list. */
  schemeId: string;
}
export interface PreparedSubmission {
  event_id: string;
  record_id: string;
  user_id: string;
  device_id: string;
  scheme_id: string;
  form_id: string;
  form_version: number;
  local_sequence: number;
  captured_at: string;
  action: 'submit';
  data: OutboxEvent['answers'];
}

function assertUuid(value: string, label: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(label + ' must be a UUID');
  }
}

/** Stable UUIDv5-shaped id from original local survey UUID + revision.
 * The same revision yields the same event ID across retries and restarts.
 */
async function stableEventId(surveyId: string, revision: number): Promise<string> {
  const bytes = new TextEncoder().encode('nimis-collect:submit:' + surveyId + ':' + revision);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const value = hash.slice(0, 16);
  value[6] = (value[6] & 0x0f) | 0x50;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/** Prepares one explicitly finalized survey revision; no automatic upload. */
export async function prepareSubmission(
  event: OutboxEvent, identity: AssignedCollectorIdentity, localSequence: number,
): Promise<PreparedSubmission> {
  assertUuid(event.surveyId, 'surveyId');
  assertUuid(identity.userId, 'userId');
  assertUuid(identity.deviceId, 'deviceId');
  if (!identity.schemeId.trim()) throw new Error('Assigned canonical scheme ID required');
  // A local sequence must be monotonic across the entire device, not per survey.
  if (!Number.isSafeInteger(localSequence) || localSequence < 1) throw new Error('Device-wide sequence required');
  if (!Number.isSafeInteger(event.revision) || event.revision < 1) throw new Error('Invalid local revision');
  if (!event.formId || !Number.isSafeInteger(event.formVersion) || (event.formVersion ?? 0) < 1) {
    throw new Error('Approved form identity and version required');
  }
  if (!Number.isFinite(Date.parse(event.createdAt)) ||
      !/[zZ]|[+-]\d\d:\d\d$/.test(event.createdAt)) throw new Error('Invalid captured timestamp');
  return {
    event_id: await stableEventId(event.surveyId, event.revision),
    record_id: event.surveyId,
    user_id: identity.userId,
    device_id: identity.deviceId,
    scheme_id: identity.schemeId,
    form_id: event.formId,
    form_version: event.formVersion!,
    local_sequence: localSequence,
    captured_at: event.createdAt,
    action: 'submit',
    data: structuredClone(event.answers),
  };
}

/** Caller supplies a current signed-in access token in memory; never persist it. */
export async function pushExplicitSubmission(
  submission: PreparedSubmission, accessToken: string,
): Promise<SecurePushResult> {
  if (!accessToken || accessToken.length > 8192) throw new Error('Valid access token required');
  const response = await fetch('/api/v1/secure/sync/push', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_id: submission.device_id, operations: [submission] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Secure sync failed with HTTP ' + response.status);
  const result = data?.results?.[0] as SecurePushResult | undefined;
  if (!result || result.event_id !== submission.event_id ||
      !['accepted', 'duplicate', 'conflict', 'rejected'].includes(result.outcome)) {
    throw new Error('Invalid secure sync acknowledgement. Keep local data and retry.');
  }
  return result; // Deliberately does NOT remove local data or photos.
}
