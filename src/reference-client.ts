import { cacheReferenceBundle, validateReferenceBundle, type ReferenceBundle } from './form-registry';

export type ServerActor = {
  user_id: string;
  role: string;
  province_ids: string[];
  district_ids: string[];
  scheme_ids: string[];
};
export type AssignedScheme = {
  scheme_id: string;
  name: string;
  province_code: string;
  district_code: string;
  master_version: number;
  is_fictional?: boolean;
};
export type ReferenceResponse = {
  actor: ServerActor;
  reference: ReferenceBundle;
  schemes: AssignedScheme[];
  formCount: number;
  formStatus: string;
  referenceStorage: 'postgresql_demo' | 'in_memory_demo';
};

const base = '/api/v1';
async function jsonFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const result = await fetch(base + url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      ...(init?.headers ?? {}),
      'Authorization': 'Bearer ' + token,
    },
  });
  if (!result.ok) throw new Error('Reference API request failed (' + result.status + ')');
  return result.json() as Promise<T>;
}

/** Only used for a localhost development backend. This token is never persisted. */
export async function loadFictionalReferenceDemo(): Promise<ReferenceResponse> {
  if (!import.meta.env.DEV) throw new Error('Demo login is disabled in production builds.');
  const tokenRes = await fetch(base + '/dev/token', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'officer.demo' }),
  });
  if (!tokenRes.ok) throw new Error('Demo reference server unavailable. Start the local Python service first.');
  const { access_token: token } = (await tokenRes.json()) as { access_token: string };

  const [actor, reference, forms] = await Promise.all([
    jsonFetch<ServerActor>('/me', token),
    jsonFetch<ReferenceBundle>('/reference', token),
    jsonFetch<{ definitions: unknown[]; review_status: string }>('/forms', token),
  ]);
  if (!validateReferenceBundle(reference)) throw new Error('Server reference response is invalid.');
  if (!Array.isArray(forms.definitions)) throw new Error('Server form list is invalid.');
  const schemes: AssignedScheme[] = [];
  const seen = new Set<string>();
  let nextCursor: string | null = null;
  let pages = 0;
  do {
    const suffix: string = nextCursor ? '&cursor=' + encodeURIComponent(nextCursor) : '';
    const page: { items: AssignedScheme[]; next_cursor: string | null; has_more: boolean } =
      await jsonFetch<{ items: AssignedScheme[]; next_cursor: string | null; has_more: boolean }>(
        '/schemes?limit=200' + suffix, token,
      );
    if (!Array.isArray(page.items) || page.items.some(item => !item.scheme_id || seen.has(item.scheme_id))) {
      throw new Error('Invalid or duplicated scheme assignment from server.');
    }
    for (const record of page.items) { seen.add(record.scheme_id); schemes.push(record); }
    pages += 1;
    if (pages > 50 || schemes.length > 10_000) throw new Error('Too many pages: narrow the scheme assignment scope.');
    if (page.has_more && (!page.next_cursor || page.next_cursor === nextCursor)) {
      throw new Error('Server returned invalid pagination cursor.');
    }
    nextCursor = page.has_more ? page.next_cursor : null;
  } while (nextCursor);
  await cacheReferenceBundle(reference);
  return {
    actor,
    reference,
    schemes,
    formCount: forms.definitions.length,
    formStatus: forms.review_status,
    referenceStorage: (reference as ReferenceBundle & { reference_storage?: 'postgresql_demo' | 'in_memory_demo' }).reference_storage ?? 'in_memory_demo',
  };
}
