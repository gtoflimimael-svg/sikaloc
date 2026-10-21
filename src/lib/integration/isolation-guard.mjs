/**
 * Garde de la recette SQL : n'autorise qu'une pile Supabase locale fraîche,
 * marquée explicitement comme jetable dans la base elle-même.
 * Ne jamais élargir à un nom de projet hébergé ou à une simple URL différente.
 */
export function verifierUrlLocale(valeur) {
  let url
  try {
    url = new URL(valeur)
  } catch {
    throw new Error('URL PostgreSQL locale invalide.')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.port !== '54322' || url.pathname !== '/postgres' ||
      url.username !== 'postgres' || url.search || url.hash) {
    throw new Error('Cible refusée : seule la base Supabase locale 127.0.0.1:54322/postgres est admise.')
  }
  return {
    host: url.hostname === '[::1]' ? '::1' : url.hostname,
    port: url.port,
    database: 'postgres',
    user: 'postgres',
    password: decodeURIComponent(url.password),
  }
}

export function verifierIntention(env) {
  if (env.SIKALOC_INTEGRATION_TARGET !== 'ephemeral-local') {
    throw new Error('Cible refusée : intention ephemeral-local obligatoire.')
  }
  const id = env.SIKALOC_INTEGRATION_INSTANCE_ID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? '')) {
    throw new Error('Identifiant de pile locale jetable absent ou invalide.')
  }
  return id.toLowerCase()
}
