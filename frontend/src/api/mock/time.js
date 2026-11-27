import { delay, serverNow } from './helpers'

export async function getServerTime() {
  await delay(60, 140)
  return serverNow()
}
