/**
 * Messages d'erreur montrés aux utilisateurs (SEC-06).
 *
 * Une erreur Postgres, PostgREST, Storage ou Auth peut porter des détails
 * internes : noms de tables, de contraintes ou de colonnes, politiques RLS,
 * messages techniques en anglais. Ils n'ont rien à faire à l'écran.
 *
 * Seuls passent tels quels les messages métier écrits en français par nos
 * propres fonctions SQL (`raise exception 'Bail introuvable ou non autorisé.'`).
 * Les erreurs techniques connues reçoivent une phrase claire ; les autres, une
 * phrase générique. La cause est journalisée côté serveur par son code
 * seulement : ni message brut, ni donnée personnelle.
 */

export type ErreurTechnique = {
  code?: string | null
  message?: string | null
  name?: string | null
  status?: number | null
}

const MARQUEURS_TECHNIQUES =
  /violates|permission denied|row-level security|relation "|column "|constraint "|function |syntax|schema|duplicate key|null value|does not exist|JWT|token|fetch failed|ECONN|timeout|_/i

/** Vrai pour un message métier rédigé en français par nos fonctions SQL. */
export function estMessageMetier(message: string | null | undefined): message is string {
  if (!message) return false
  const texte = message.trim()
  if (texte.length < 4 || texte.length > 220) return false
  // Nos messages commencent par une majuscule et forment une phrase.
  if (!/^[A-ZÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ]/.test(texte)) return false
  if (MARQUEURS_TECHNIQUES.test(texte)) return false
  return /[.!?]$/.test(texte)
}

const MESSAGES_AUTH: Record<string, string> = {
  same_password: 'Le nouveau mot de passe doit être différent de l’actuel.',
  weak_password: 'Ce mot de passe est trop faible. Choisissez-en un plus long et moins courant.',
  email_exists: 'Un compte existe déjà avec cette adresse.',
  user_already_exists: 'Un compte existe déjà avec cette adresse.',
  over_request_rate_limit: 'Trop de demandes. Patientez quelques minutes puis réessayez.',
  over_email_send_rate_limit: 'Trop d’emails envoyés. Patientez quelques minutes puis réessayez.',
  reauthentication_needed: 'Reconnectez-vous puis réessayez.',
  session_not_found: 'Votre session a expiré. Reconnectez-vous.',
}

const MESSAGES_POSTGRES: Record<string, string> = {
  '23505': 'Cet élément existe déjà.',
  '23503': 'Cet élément est lié à d’autres données ou n’existe plus.',
  '42501': 'Action non autorisée.',
  '22P02': 'Une valeur saisie est invalide.',
  '22001': 'Une valeur saisie est trop longue.',
  '40001': 'Opération concurrente détectée. Réessayez.',
  '57014': 'L’opération a pris trop de temps. Réessayez.',
}

/**
 * Phrase sûre à afficher pour une erreur, préfixée par le contexte.
 *
 * @param contexte « Enregistrement impossible », « Suppression impossible »…
 * @param journal  étiquette de journal, par exemple `logements.creer`.
 */
export function messageErreurUtilisateur(
  erreur: ErreurTechnique | unknown,
  contexte: string,
  journal: string,
): string {
  const e = (erreur && typeof erreur === 'object' ? erreur : {}) as ErreurTechnique
  const code = typeof e.code === 'string' ? e.code : null

  console.error(`[${journal}] ${contexte}`, {
    code: code && /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : 'inconnu',
    status: typeof e.status === 'number' ? e.status : undefined,
  })

  if (estMessageMetier(e.message)) return e.message.trim()
  if (code && MESSAGES_AUTH[code]) return MESSAGES_AUTH[code]
  if (code && MESSAGES_POSTGRES[code]) return `${contexte} : ${MESSAGES_POSTGRES[code].charAt(0).toLowerCase()}${MESSAGES_POSTGRES[code].slice(1)}`
  return `${contexte}. Réessayez dans un instant ; si le problème continue, contactez le support.`
}
