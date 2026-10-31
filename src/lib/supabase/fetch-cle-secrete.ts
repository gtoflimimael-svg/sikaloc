/**
 * Supabase secret keys authenticate via `apikey`, never as a Bearer token.
 * supabase-js 2.x still adds its API key as a Bearer fallback on some request
 * paths, so remove only that exact synthetic header while preserving a user's
 * access token on authenticated requests.
 */
export function fetchSupabaseSansSecretBearer(
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value))

    const apiKey = headers.get('apikey')
    if (
      apiKey?.startsWith('sb_secret_') &&
      headers.get('authorization') === `Bearer ${apiKey}`
    ) {
      headers.delete('authorization')
    }

    return fetcher(input, { ...init, headers })
  }
}
