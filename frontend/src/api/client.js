// Fetch wrapper. The short-lived access token lives only in memory; the long-lived refresh
// token is an httpOnly cookie the browser sends by itself. When a request comes back 401
// we refresh once (single-flight, so parallel requests share one refresh) and retry.
let accessToken = null;
let refreshing = null;
let onAuthLost = () => {};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const setAccessToken = (t) => { accessToken = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

async function raw(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`/api${path}`, {
    method, headers, signal, credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.detail || `Request failed (${res.status})`, res.status);
  return data;
}

/** Trades the refresh cookie for a new access token. Resolves to the auth payload, or throws. */
export function refreshSession() {
  refreshing ??= (async () => {
    try {
      let res = await raw('/auth/refresh', { method: 'POST' });
      if (res.status === 401) {
        // No cookie at all means "not signed in": nothing to retry. Otherwise two tabs may have
        // rotated at the same instant, so retry once with the cookie the winner just set.
        const body = await res.clone().json().catch(() => null);
        if (body?.detail !== 'Not signed in.') {
          await new Promise((r) => setTimeout(r, 400));
          res = await raw('/auth/refresh', { method: 'POST' });
        }
      }
      const data = await parse(res);
      accessToken = data.access_token;
      return data;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api(path, options) {
  let res = await raw(path, options);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      accessToken = null;
      onAuthLost();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }
    res = await raw(path, options);
  }
  return parse(res);
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });
