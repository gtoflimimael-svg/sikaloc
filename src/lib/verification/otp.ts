import 'server-only'

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

import { creerClientAdmin } from '@/lib/supabase/admin'
import {
  DELAI_RENVOI_SECONDES,
  DEMANDES_MAXIMALES_PAR_HEURE,
  LONGUEUR_CODE,
  TENTATIVES_MAXIMALES,
  VALIDITE_MINUTES,
  type CanalTelephone,
  type MotifRefus,
} from '@/lib/verification/regles'

/**
 * Le service OTP de Sikaloc — génération, conservation, validation.
 *
 * ─── Périmètre ──────────────────────────────────────────────────────────────
 *
 * Ce fichier ne s'occupe QUE du téléphone.
 *
 * L'email passe par GoTrue, qui génère, envoie et valide son propre code : le
 * réimplémenter ici aurait voulu dire écrire un deuxième mécanisme de sécurité
 * à côté d'un mécanisme éprouvé, puis maintenir les deux. La colonne `type`
 * existe néanmoins avec ses deux valeurs, et ce n'est pas décoratif : elle rend
 * la séparation des contextes vérifiable, et laisserait l'email migrer ici sans
 * refaire le schéma.
 *
 * Conséquence heureuse : un code email ne peut structurellement pas valider un
 * téléphone. Ils ne vivent pas dans le même système.
 *
 * ─── Le code n'existe qu'en transit ─────────────────────────────────────────
 *
 * Il est rendu à l'appelant une seule fois, pour être envoyé. La base ne reçoit
 * qu'une empreinte HMAC-SHA256 calculée avec un secret d'environnement. Le code
 * n'apparaît ni dans un journal, ni dans une réponse d'API, ni dans un message
 * d'erreur.
 *
 * ─── Trois limites, et non une longueur ─────────────────────────────────────
 *
 * Six chiffres se devinent en un million d'essais. La protection ne vient donc
 * pas du code mais de ce qui l'encadre : dix minutes de validité, cinq essais,
 * cinq demandes par heure. Toutes appliquées ici, côté serveur. Le compte à
 * rebours affiché à l'écran n'est qu'une politesse.
 */

const TYPE_TELEPHONE = 'PHONE_VERIFICATION'

/** L'empreinte, ou une erreur claire si le secret manque. */
function empreinte(code: string): string {
  const secret = process.env.OTP_SECRET

  // Pas de repli silencieux. Un `sha256` sans secret serait cassable hors ligne
  // en une milliseconde si la table fuitait — donc une sécurité affichée mais
  // absente, ce qui est pire que pas de sécurité du tout.
  if (!secret || secret.length < 32) {
    throw new Error('OTP_SECRET absente ou trop courte (32 caractères minimum).')
  }

  return createHmac('sha256', secret).update(code).digest('hex')
}

export function secretOtpPresent(): boolean {
  const secret = process.env.OTP_SECRET
  return Boolean(secret && secret.length >= 32)
}

/**
 * Un code à six chiffres, tiré du générateur cryptographique du système.
 *
 * `randomInt` et non `Math.random()` : le second est prévisible à partir de
 * quelques tirages observés, ce qui suffirait à deviner le code d'autrui.
 *
 * Les zéros de tête sont conservés — « 004821 » est un code aussi valable que
 * « 904821 », et les exclure retirerait des combinaisons.
 */
function tirerCode(): string {
  const maximum = 10 ** LONGUEUR_CODE
  return String(randomInt(0, maximum)).padStart(LONGUEUR_CODE, '0')
}

export interface DemandeCode {
  ok: boolean
  motif?: MotifRefus
  /** Le code en clair, uniquement pour l'envoi immédiat. Jamais conservé. */
  code?: string
  /** Secondes à attendre avant un nouveau renvoi, quand c'est trop tôt. */
  attendreSecondes?: number
}

/**
 * Prépare un code pour un téléphone : vérifie les limites, invalide le
 * précédent, enregistre l'empreinte du nouveau.
 *
 * N'envoie rien. C'est l'appelant qui décide du canal et qui passe par
 * `canaux.ts` — cette séparation permet de ne pas brûler un code quand le
 * transport est indisponible.
 */
export async function preparerCodeTelephone(
  bailleurId: string,
  telephoneCanonique: string,
  canal: CanalTelephone,
  ip?: string | null,
): Promise<DemandeCode> {
  const admin = creerClientAdmin()
  const maintenant = Date.now()

  // ── Limite de débit : cinq demandes par heure et par compte ──────────────
  const ilYAUneHeure = new Date(maintenant - 3_600_000).toISOString()
  const { count: demandesRecentes } = await admin
    .from('codes_verification')
    .select('id', { count: 'exact', head: true })
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .gte('cree_le', ilYAUneHeure)

  if ((demandesRecentes ?? 0) >= DEMANDES_MAXIMALES_PAR_HEURE) {
    return { ok: false, motif: 'trop_de_demandes' }
  }

  // ── Délai entre deux demandes ────────────────────────────────────────────
  const { data: dernier } = await admin
    .from('codes_verification')
    .select('cree_le')
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .order('cree_le', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dernier) {
    const ecoule = (maintenant - new Date(dernier.cree_le).getTime()) / 1000
    if (ecoule < DELAI_RENVOI_SECONDES) {
      return {
        ok: false,
        motif: 'renvoi_trop_tot',
        attendreSecondes: Math.ceil(DELAI_RENVOI_SECONDES - ecoule),
      }
    }
  }

  const code = tirerCode()

  let signature: string
  try {
    signature = empreinte(code)
  } catch {
    // Secret absent : on refuse plutôt que de stocker une empreinte faible.
    return { ok: false, motif: 'canal_indisponible' }
  }

  // ── Un nouveau code annule le précédent ──────────────────────────────────
  //
  // Avant l'insertion, pas après : si l'insertion échoue, il vaut mieux se
  // retrouver sans code courant qu'avec deux codes valables en même temps.
  await admin
    .from('codes_verification')
    .update({ invalide_le: new Date(maintenant).toISOString() })
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .is('utilise_le', null)
    .is('invalide_le', null)

  const { error } = await admin.from('codes_verification').insert({
    bailleur_id: bailleurId,
    type: TYPE_TELEPHONE,
    canal,
    destination: telephoneCanonique,
    empreinte: signature,
    expire_le: new Date(maintenant + VALIDITE_MINUTES * 60_000).toISOString(),
    ip: ip ?? null,
  })

  if (error) return { ok: false, motif: 'canal_indisponible' }

  return { ok: true, code }
}

/**
 * Annule le code courant sans en créer de nouveau.
 *
 * Appelé quand l'envoi échoue : un code enregistré mais jamais reçu occuperait
 * la place du suivant et consommerait un quota horaire pour rien.
 */
export async function annulerCodeCourant(bailleurId: string): Promise<void> {
  const admin = creerClientAdmin()
  await admin
    .from('codes_verification')
    .update({ invalide_le: new Date().toISOString() })
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .is('utilise_le', null)
    .is('invalide_le', null)
}

export interface VerdictCode {
  ok: boolean
  motif?: MotifRefus
  /** Canal par lequel le code validé avait été envoyé — trace de sécurité. */
  canal?: CanalTelephone
  /** Essais restants sur ce code, quand il en reste. */
  essaisRestants?: number
}

/**
 * Valide un code saisi contre le code courant du bailleur.
 *
 * L'ordre des contrôles n'est pas indifférent :
 *
 *   1. existe-t-il un code en attente ?
 *   2. les essais sont-ils épuisés ?
 *   3. est-il expiré ?
 *   4. correspond-il ?
 *
 * Le comptage des essais est incrémenté AVANT la comparaison. Autrement, une
 * requête interrompue juste après un mauvais code laisserait le compteur
 * intact, et cinq essais deviendraient illimités.
 */
export async function verifierCodeTelephone(
  bailleurId: string,
  telephoneCanonique: string,
  saisie: string,
): Promise<VerdictCode> {
  const admin = creerClientAdmin()
  const chiffres = saisie.replace(/\D/g, '')

  const { data: courant } = await admin
    .from('codes_verification')
    .select('id, empreinte, expire_le, tentatives, canal, destination')
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .is('utilise_le', null)
    .is('invalide_le', null)
    .order('cree_le', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!courant) return { ok: false, motif: 'code_absent' }

  // Le code avait été envoyé à un autre numéro : le bailleur a changé de numéro
  // entre la demande et la saisie. Le code ne prouve rien sur le nouveau.
  if (courant.destination !== telephoneCanonique) {
    await admin
      .from('codes_verification')
      .update({ invalide_le: new Date().toISOString() })
      .eq('id', courant.id)
    return { ok: false, motif: 'code_absent' }
  }

  if (courant.tentatives >= TENTATIVES_MAXIMALES) {
    return { ok: false, motif: 'tentatives_epuisees' }
  }

  // Incrémenté d'abord : un abandon de requête ne doit pas rendre l'essai
  // gratuit.
  const tentatives = courant.tentatives + 1
  await admin
    .from('codes_verification')
    .update({ tentatives })
    .eq('id', courant.id)

  if (new Date(courant.expire_le).getTime() < Date.now()) {
    return { ok: false, motif: 'code_expire' }
  }

  if (chiffres.length !== LONGUEUR_CODE) {
    return {
      ok: false,
      motif: 'code_incorrect',
      essaisRestants: TENTATIVES_MAXIMALES - tentatives,
    }
  }

  let correspond = false
  try {
    const attendu = Buffer.from(courant.empreinte, 'hex')
    const fourni = Buffer.from(empreinte(chiffres), 'hex')
    // Comparaison à temps constant : un `===` sur des chaînes s'arrête au
    // premier octet différent, et la durée de la réponse trahit alors combien
    // d'octets étaient corrects.
    correspond = attendu.length === fourni.length && timingSafeEqual(attendu, fourni)
  } catch {
    return { ok: false, motif: 'code_incorrect' }
  }

  if (!correspond) {
    return {
      ok: false,
      motif:
        tentatives >= TENTATIVES_MAXIMALES ? 'tentatives_epuisees' : 'code_incorrect',
      essaisRestants: TENTATIVES_MAXIMALES - tentatives,
    }
  }

  // ── Usage unique ─────────────────────────────────────────────────────────
  //
  // Le filtre `is('utilise_le', null)` fait de cette écriture la course
  // gagnante : deux requêtes simultanées avec le même bon code, une seule
  // consomme. Sans lui, un code pourrait servir deux fois.
  const { data: consomme } = await admin
    .from('codes_verification')
    .update({ utilise_le: new Date().toISOString() })
    .eq('id', courant.id)
    .is('utilise_le', null)
    .select('id')
    .maybeSingle()

  if (!consomme) return { ok: false, motif: 'code_absent' }

  return { ok: true, canal: courant.canal as CanalTelephone }
}

/**
 * Secondes restantes avant qu'un renvoi soit permis, pour amorcer le compte à
 * rebours de l'écran sur la valeur que le serveur appliquera vraiment.
 */
export async function attenteAvantRenvoi(bailleurId: string): Promise<number> {
  const admin = creerClientAdmin()

  const { data: dernier } = await admin
    .from('codes_verification')
    .select('cree_le')
    .eq('bailleur_id', bailleurId)
    .eq('type', TYPE_TELEPHONE)
    .order('cree_le', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!dernier) return 0

  const ecoule = (Date.now() - new Date(dernier.cree_le).getTime()) / 1000
  return Math.max(0, Math.ceil(DELAI_RENVOI_SECONDES - ecoule))
}
