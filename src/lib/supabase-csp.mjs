const FALLBACK_ORIGINS = Object.freeze({
  httpOrigin: 'http://127.0.0.1:54321',
  websocketOrigin: 'ws://127.0.0.1:54321',
})

/** @param {string | undefined} rawUrl */
export function getSupabaseCspOrigins(rawUrl) {
  if (!rawUrl) return FALLBACK_ORIGINS

  try {
    const url = new URL(rawUrl)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return FALLBACK_ORIGINS
    }

    const websocketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return {
      httpOrigin: url.origin,
      websocketOrigin: `${websocketProtocol}//${url.host}`,
    }
  } catch {
    return FALLBACK_ORIGINS
  }
}
