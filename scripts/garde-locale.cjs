/**
 * Le garde-fou des bancs : prouver qu'on parle bien à la pile LOCALE.
 *
 * ─── Ce qui a motivé ce fichier ────────────────────────────────────────────
 *
 * Chaque banc portait sa propre copie de la vérification, et toutes lisaient
 * la même chose : l'URL. Or `.env.local` — le fichier que l'on charge par
 * réflexe — pointe sur la PRODUCTION. Un banc qui crée des comptes, envoie des
 * candidatures et supprime des utilisateurs n'a droit à aucune approximation
 * ici, et `verifier-schema.ts` n'avait, lui, aucune vérification du tout : il a
 * interrogé la base de production sans rien signaler.
 *
 * ─── Pourquoi l'URL ne suffit pas ──────────────────────────────────────────
 *
 * Une URL est une intention, pas une preuve. `localhost:54321` peut être un
 * tunnel ; une variable peut être écrasée entre deux lignes ; et surtout, rien
 * n'oblige l'URL et la CLÉ à désigner la même base — c'est le mélange le plus
 * dangereux, parce qu'il a l'air local.
 *
 * La clé, elle, est signée. Le jeton du service local porte
 * `iss: "supabase-demo"` et aucune référence de projet ; celui d'un projet
 * hébergé porte `iss: "supabase"` et le `ref` du projet. On lit donc la clé,
 * et pas seulement l'adresse. Un jeton de production échoue même si l'URL dit
 * « localhost ».
 *
 * Ce n'est pas de la cryptographie : la charge d'un JWT se lit sans le
 * vérifier. Mais fabriquer une clé qui prétende être locale tout en ouvrant la
 * production demanderait la signature du projet — c'est-à-dire de l'avoir déjà.
 */

/** La charge utile d'un JWT, ou `null` si ce n'en est pas un. */
function charge(jeton) {
  const morceaux = String(jeton || '').split('.')
  if (morceaux.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(morceaux[1], 'base64').toString('utf8'))
  } catch {
    return null
  }
}

const HOTES_LOCAUX = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/**
 * Dit si cet environnement est la pile locale, et pourquoi il ne l'est pas.
 *
 * Rend `{ locale: true }` ou `{ locale: false, motif }` — testable, là où un
 * `process.exit` ne l'est pas.
 */
function examinerPileLocale({ url, cles } = {}) {
  const adresse = url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!adresse) return { locale: false, motif: 'aucune URL Supabase n’est définie' }

  let hote
  try {
    hote = new URL(adresse).hostname
  } catch {
    return { locale: false, motif: `« ${adresse} » n’est pas une URL` }
  }
  if (!HOTES_LOCAUX.has(hote)) {
    return { locale: false, motif: `${adresse} n’est pas une adresse locale` }
  }

  const jetons = cles ?? [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ]
  for (const jeton of jetons) {
    if (!jeton) continue
    const c = charge(jeton)
    if (!c) return { locale: false, motif: 'une clé Supabase n’est pas un jeton lisible' }
    if (c.ref) {
      return { locale: false, motif: `une clé désigne le projet hébergé « ${c.ref} »` }
    }
    if (c.iss !== 'supabase-demo') {
      return { locale: false, motif: `une clé est émise par « ${c.iss ?? 'inconnu'} », pas par la pile locale` }
    }
  }

  return { locale: true }
}

/**
 * Refuse de continuer si ce n'est pas la pile locale.
 *
 * À appeler AVANT le premier client Supabase, dans tout script qui écrit.
 */
function exigerPileLocale(nom = 'Ce script') {
  const verdict = examinerPileLocale()
  if (verdict.locale) return

  console.error(
    `\nRefus : ${verdict.motif}.\n\n` +
      `${nom} écrit dans la base : il ne s’exécute que sur la pile locale.\n` +
      `Chargez l’environnement local, et non « .env.local » qui vise la production :\n\n` +
      '  set -a && . ./.env.development.local && set +a\n',
  )
  process.exit(1)
}

module.exports = { charge, examinerPileLocale, exigerPileLocale }
