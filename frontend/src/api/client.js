/**
 * Thin fetch wrapper used by every API function.
 *
 *  - base URL from VITE_API_URL, cookies sent with every request
 *  - JSON in / JSON out
 *  - every failure throws an ApiError with the normalized shape
 *      { code, message, details }  (plus `status` for convenience)
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
}

const DEFAULT_MESSAGES = {
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
}

export class ApiError extends Error {
  constructor({ code = 'UNKNOWN_ERROR', message = 'Something went wrong.', details = null, status = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

let unauthorizedHandler = null

/** Lets the auth layer react to a 401 on any endpoint (session expired). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function notifyUnauthorized() {
  unauthorizedHandler?.()
}

function normalizeError(status, body) {
  // Accept both `{ error: { code, message, details } }` and a flat body.
  const source = body && typeof body === 'object' ? (body.error && typeof body.error === 'object' ? body.error : body) : {}
  return new ApiError({
    code: source.code ?? DEFAULT_CODES[status] ?? (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED'),
    message:
      (typeof source.message === 'string' && source.message) ||
      DEFAULT_MESSAGES[status] ||
      (status >= 500 ? 'The server ran into a problem. Please try again.' : 'The request could not be completed.'),
    details: source.details ?? null,
    status,
  })
}

async function parseBody(response) {
  if (response.status === 204) return null
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * `blob: true` is for file downloads (PDF, CSV): resolves to `{ blob, filename }`,
 * with the filename taken from the Content-Disposition header.
 */
export async function request(path, { method = 'GET', body, params, signal, skipUnauthorizedHandler = false, blob = false } = {}) {
  let url = `${BASE_URL}${path}`
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ).toString()
    if (query) url += `?${query}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: "We couldn't reach the server. Check your connection and try again.",
    })
  }

  if (blob && response.ok) {
    const disposition = response.headers.get('content-disposition') ?? ''
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? 'download'
    return { blob: await response.blob(), filename }
  }

  const data = await parseBody(response)
  if (!response.ok) {
    if (response.status === 401 && !skipUnauthorizedHandler) notifyUnauthorized()
    throw normalizeError(response.status, data)
  }
  return data
}

/**
 * Endpoints may return a bare payload, a named key (`{ user }`), or a standard
 * data envelope (`{ data: payload }`). Return the payload in each case.
 */
export function pick(response, key) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return response
  if (key in response) return response[key]

  const payload = response.data ?? response
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && key in payload) return payload[key]
  return payload
}

/** Maps server-side field errors (`details`) onto react-hook-form fields. */
export function applyFieldErrors(error, setError) {
  const details = error?.details
  if (!details) return false
  const entries = Array.isArray(details)
    ? details.map((d) => [d.field ?? d.path, d.message])
    : typeof details === 'object'
      ? Object.entries(details)
      : []
  let applied = false
  for (const [field, message] of entries) {
    if (field && typeof message === 'string') {
      setError(field, { type: 'server', message })
      applied = true
    }
  }
  return applied
}
