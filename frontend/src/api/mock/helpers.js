import { ApiError } from '../client'

/** The mock "server" clock runs slightly ahead of the device clock on purpose. */
export const MOCK_CLOCK_SKEW_MS = 2500

export const serverNow = () => Date.now() + MOCK_CLOCK_SKEW_MS

export function delay(min = 220, max = 520) {
  const ms = Math.round(min + Math.random() * (max - min))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function fail(status, code, message, details = null) {
  throw new ApiError({ status, code, message, details })
}

export const clone = (value) => structuredClone(value)

// --- session (stands in for the httpOnly cookie) ---------------------------

const SESSION_KEY = 'quillmark.mock.session'

export function setSession(userId) {
  if (userId) sessionStorage.setItem(SESSION_KEY, userId)
  else sessionStorage.removeItem(SESSION_KEY)
}

export function getSessionUserId() {
  return sessionStorage.getItem(SESSION_KEY)
}
