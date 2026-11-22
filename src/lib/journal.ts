/**
 * Journal des échecs côté serveur (OPS-07).
 *
 * Une erreur interceptée pour afficher un message propre ne doit jamais
 * disparaître : elle est écrite ici avec son étiquette, son type, son code et,
 * pour un refus d'émission, l'étape fautive. `console.error` alimente les
 * journaux Vercel et, quand Sentry est configuré, devient un événement Sentry
 * (intégration `captureConsoleIntegration`, voir `sentry.server.config.ts`).
 *
 * Aucune donnée personnelle : ni message brut d'une base ou d'un service
 * externe (il peut citer une valeur saisie), ni email, ni téléphone.
 */

type Detail = Record<string, string | number | boolean | undefined>

function decrire(cause: unknown): Detail {
  if (!cause || typeof cause !== 'object') return { type: typeof cause }
  const e = cause as { name?: unknown; code?: unknown; status?: unknown; cause?: unknown }
  const detail: Detail = {
    type: typeof e.name === 'string' ? e.name : 'objet',
    code: typeof e.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(e.code) ? e.code : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
  }
  const origine = e.cause && typeof e.cause === 'object'
    ? e.cause as { etape?: unknown; code?: unknown; nom?: unknown }
    : null
  if (origine) {
    if (typeof origine.etape === 'string' && /^[a-z_]{1,40}$/.test(origine.etape)) detail.etape = origine.etape
    if (typeof origine.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(origine.code)) detail.code_origine = origine.code
    if (typeof origine.nom === 'string' && /^[A-Za-z]{1,40}$/.test(origine.nom)) detail.type_origine = origine.nom
  }
  return detail
}

export function journaliserEchec(etiquette: string, cause: unknown, contexte: Detail = {}): void {
  console.error(`[${etiquette}] échec`, { ...contexte, ...decrire(cause) })
}
