import 'server-only'

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * La boîte aux lettres locale — pour que développer n'écrive à personne.
 *
 * ─── Le problème ───────────────────────────────────────────────────────────
 *
 * Sikaloc n'envoie pas ses emails en SMTP : `envoyerEmail` appelle l'API HTTP
 * de Resend. Le serveur de test livré avec la pile locale (Inbucket) n'aide
 * donc pas ici — il écoute en SMTP, et son port n'est même pas publié sur la
 * machine ; seul GoTrue, dans le réseau des conteneurs, pourrait s'en servir.
 *
 * Restait le choix entre ne pas tester l'envoi, ou envoyer de vrais messages
 * depuis une machine de développement — vers des adresses en `@exemple.test`
 * qui n'existent pas, avec de vrais rebonds sur un vrai compte Resend. Aucun
 * des deux n'est acceptable.
 *
 * ─── La règle ──────────────────────────────────────────────────────────────
 *
 * Sur la pile locale, et seulement là, le courrier est DÉPOSÉ sur le disque au
 * lieu d'être expédié. Tout le reste est identique : mêmes modèles, mêmes
 * variables, même HTML, même clé d'idempotence, même file, même travailleur.
 * Ce qui est vérifié est donc bien ce qui partirait.
 *
 * ─── Pourquoi la clé, et pas une variable d'environnement ─────────────────
 *
 * Un `EMAIL_TRANSPORT=local` oublié dans un environnement distant ferait
 * disparaître silencieusement tous les emails d'un vrai bailleur. La preuve
 * est donc prise là où elle ne peut pas être posée par erreur : le jeton de
 * service de la pile locale porte `iss: "supabase-demo"` et aucune référence
 * de projet, quand celui d'un projet hébergé porte `iss: "supabase"` et son
 * `ref`. En production, cette fonction ne peut pas répondre vrai.
 *
 * C'est la règle de `scripts/garde-locale.cjs`, qui garde les bancs. Un test
 * du banc S8-D vérifie que les deux répondent la même chose.
 */

const HOTES_LOCAUX = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** La charge utile d'un JWT, sans en vérifier la signature. */
function charge(jeton: string | undefined): Record<string, unknown> | null {
  const morceaux = String(jeton ?? '').split('.')
  if (morceaux.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(morceaux[1], 'base64').toString('utf8'))
  } catch {
    return null
  }
}

/** Parle-t-on à la pile locale — l'URL ET la clé ? */
export function pileLocale(): boolean {
  let hote: string
  try {
    hote = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return false
  }
  if (!HOTES_LOCAUX.has(hote)) return false

  const jeton = charge(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!jeton) return false
  if (jeton.ref) return false
  return jeton.iss === 'supabase-demo'
}

/** Le dossier de dépôt, ignoré par git. */
export const DOSSIER_COURRIER = '.emails-locaux'

export interface CourrierDepose {
  destinataire: string
  modele: string
  sujet: string
  html: string
  texte: string
  idempotence: string | null
  depose_le: string
}

/**
 * Écrit le message sur le disque et rend l'identifiant du dépôt.
 *
 * Un fichier par message, nommé par l'instant et la clé d'idempotence : un
 * rejeu de la file réécrit le même fichier au lieu d'en créer un second, comme
 * l'en-tête `Idempotency-Key` l'obtiendrait de Resend.
 */
export function deposerCourrierLocal(courrier: Omit<CourrierDepose, 'depose_le'>): string {
  const dossier = join(process.cwd(), DOSSIER_COURRIER)
  mkdirSync(dossier, { recursive: true })

  const nom = `${courrier.idempotence ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}.json`
  writeFileSync(
    join(dossier, nom),
    JSON.stringify({ ...courrier, depose_le: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return nom
}
