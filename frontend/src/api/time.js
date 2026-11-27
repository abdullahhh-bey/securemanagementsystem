import { USE_MOCK, request } from './client'
import * as mock from './mock/time'

// GET /api/time -> { serverTime: ISO string | epoch ms }   returns epoch ms
export async function getServerTime() {
  if (USE_MOCK) return mock.getServerTime()
  const response = await request('/api/time')
  const raw = response?.serverTime ?? response?.time ?? response?.now ?? response
  const ms = typeof raw === 'number' ? raw : new Date(raw).getTime()
  if (Number.isNaN(ms)) throw new Error('Unexpected /api/time response')
  return ms
}
