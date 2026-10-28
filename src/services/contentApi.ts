import { CMSContentEntry } from '../types';

interface ApiError {
  error?: string;
}

export async function apiRequest<T>(
  url: string,
  init: RequestInit = {},
  csrfToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json().catch((): ApiError => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface PublicContentResponse {
  items: CMSContentEntry[];
  initialized: boolean;
}

export function validatePagePath(value: string): string {
  return /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(value) ? value : '/';
}
