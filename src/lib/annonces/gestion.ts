import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { BUCKET_PHOTOS_ANNONCES } from '@/lib/annonces/depot-photos'
import { MESSAGES_ANNONCE, traduireErreurAnnonce, type CleMessageAnnonce } from '@/lib/annonces/erreurs'
import type { Database, MotifClotureAnnonce, StatutAnnonce } from '@/lib/types/database'
import type { ChampsAnnonce } from '@/lib/validation'

/**
 * Gestion des annonces par leur bailleur — le cœur des actions de S4.
 *
 * Tout passe par `db`, le client à la SESSION du bailleur : les politiques de
 * S1 décident de ce qu'il voit et de ce qu'il écrit. Une annonce d'un autre
 * bailleur n'est pas « interdite » ici, elle est introuvable — la même
 * réponse qu'un identifiant qui n'existe pas.
 *
 * Aucune règle de publication n'est refaite en TypeScript. Le code choisit la
 * transition demandée ; la base juge si elle est permise, et
 * `traduireErreurAnnonce` dit pourquoi elle ne l'est pas.
 *
 * Séparé des Server Actions pour être exercé par le banc avec de vraies
 * sessions, comme `depot-photos.ts`.
 */

type Client = SupabaseClient<Database>

export type Refus = { ok: false; message: string }
const refus = (cle: CleMessageAnnonce): Refus => ({ ok: false, message: MESSAGES_ANNONCE[cle] })
const refusBase = (erreur: { code?: string; message?: string }): Refus => ({
  ok: false,
  message: traduireErreurAnnonce(erreur),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function session(db: Client): Promise<string | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  return user?.id ?? null
}

/** L'annonce vivante (non clôturée) d'un logement, s'il en a une. */
async function annonceVivante(db: Client, logementId: string): Promise<string | null> {
  const { data } = await db
    .from('annonces')
    .select('id')
    .eq('logement_id', logementId)
    .neq('statut', 'cloturee')
    .maybeSingle()
  return data?.id ?? null
}

async function lireAnnonce(db: Client, id: string) {
  if (!UUID.test(id)) return null
  const { data } = await db.from('annonces').select('id, statut').eq('id', id).maybeSingle()
  return data
}

/**
 * Crée le brouillon d'un logement, ou désigne celui qui existe déjà.
 *
 * `bailleur_id` vient de la session. Le type et la ville sont RECOPIÉS du
 * logement : l'annonce les garde ensuite pour elle — c'est ce qui lui permet
 * de survivre au logement une fois clôturée.
 *
 * Un logement qui a déjà une annonce vivante n'en reçoit pas une seconde :
 * on renvoie l'existante. Deux créations simultanées butent sur l'index
 * unique partiel de S1 ; la perdante relit, et renvoie la gagnante.
 */
export async function creerBrouillon(
  db: Client,
  logementId: string,
): Promise<{ ok: true; id: string; existante: boolean } | Refus> {
  const bailleurId = await session(db)
  if (!bailleurId) return refus('non_autorise')
  if (!UUID.test(logementId)) return refus('logement_introuvable')

  const { data: logement } = await db
    .from('logements')
    .select('id, bailleur_id, type, ville')
    .eq('id', logementId)
    .maybeSingle()
  if (!logement || logement.bailleur_id !== bailleurId) return refus('logement_introuvable')

  const existante = await annonceVivante(db, logement.id)
  if (existante) return { ok: true, id: existante, existante: true }

  const { data, error } = await db
    .from('annonces')
    .insert({
      bailleur_id: bailleurId,
      logement_id: logement.id,
      type: logement.type,
      ville: logement.ville,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const gagnante = await annonceVivante(db, logement.id)
      if (gagnante) return { ok: true, id: gagnante, existante: true }
    }
    return refusBase(error)
  }
  return { ok: true, id: data.id, existante: false }
}

/**
 * Enregistre les champs d'une annonce.
 *
 * Jamais `reference`, `bailleur_id`, `logement_id`, `statut` ni le type : ils
 * ne font pas partie de ce qu'on écrit ici. Une annonce publiée se modifie
 * aussi — et si la modification la rendait impubliable (quartier effacé,
 * disponibilité avancée avant la fin du bail), c'est la base qui refuse.
 *
 * Une annonce clôturée ne se modifie plus : c'est une archive.
 */
export async function modifierAnnonce(
  db: Client,
  id: string,
  champs: ChampsAnnonce,
): Promise<{ ok: true } | Refus> {
  if (!(await session(db))) return refus('non_autorise')
  const annonce = await lireAnnonce(db, id)
  if (!annonce) return refus('introuvable')
  if (annonce.statut === 'cloturee') return refus('cloturee')

  const { data, error } = await db
    .from('annonces')
    .update({
      ville: champs.ville,
      quartier: champs.quartier ?? null,
      chambres: champs.chambres ?? null,
      surface_m2: champs.surfaceM2 ?? null,
      loyer: champs.loyer ?? null,
      charges: champs.charges ?? null,
      depot_garantie: champs.depotGarantie ?? null,
      avance_mois: champs.avanceMois ?? null,
      equipements: [...new Set(champs.equipements)],
      description: champs.description ?? null,
      disponible_le: champs.disponibleLe ?? null,
    })
    .eq('id', annonce.id)
    .neq('statut', 'cloturee')
    .select('id')

  if (error) return refusBase(error)
  if (!data || data.length === 0) return refus('statut_change')
  return { ok: true }
}

export type Transition = 'publier' | 'suspendre' | 'reprendre'

const TRANSITIONS: Record<Transition, { depuis: StatutAnnonce; vers: StatutAnnonce }> = {
  publier: { depuis: 'brouillon', vers: 'publiee' },
  suspendre: { depuis: 'publiee', vers: 'suspendue' },
  reprendre: { depuis: 'suspendue', vers: 'publiee' },
}

/**
 * Publier, suspendre, reprendre.
 *
 * Le statut de départ est exigé dans la requête elle-même (`eq('statut')`) :
 * deux onglets qui publient et suspendent en même temps ne peuvent pas
 * produire un saut de statut que personne n'a demandé.
 */
export async function changerStatut(
  db: Client,
  id: string,
  transition: Transition,
): Promise<{ ok: true } | Refus> {
  if (!(await session(db))) return refus('non_autorise')
  const annonce = await lireAnnonce(db, id)
  if (!annonce) return refus('introuvable')
  if (annonce.statut === 'cloturee') return refus('cloturee')

  const { depuis, vers } = TRANSITIONS[transition]
  if (annonce.statut !== depuis) return refus('statut_change')

  const { data, error } = await db
    .from('annonces')
    .update({ statut: vers })
    .eq('id', annonce.id)
    .eq('statut', depuis)
    .select('id')

  if (error) return refusBase(error)
  if (!data || data.length === 0) return refus('statut_change')
  return { ok: true }
}

/** Les clôtures qu'un bailleur peut demander. `louee_sikaloc` attendra S9. */
export type MotifClotureManuelle = Extract<MotifClotureAnnonce, 'louee_ailleurs' | 'retiree'>

/**
 * Clôturer une annonce publiée ou suspendue, avec un motif.
 *
 * Un brouillon ne se clôture pas : il n'a jamais été vu, il se supprime.
 * Et un brouillon incomplet violerait la contrainte de complétude.
 */
export async function cloturerAnnonce(
  db: Client,
  id: string,
  motif: MotifClotureManuelle,
): Promise<{ ok: true } | Refus> {
  if (!(await session(db))) return refus('non_autorise')
  if (motif !== 'louee_ailleurs' && motif !== 'retiree') return refus('echec')
  const annonce = await lireAnnonce(db, id)
  if (!annonce) return refus('introuvable')
  if (annonce.statut === 'cloturee') return refus('cloturee')
  if (annonce.statut === 'brouillon') return refus('brouillon_non_cloturable')

  const { data, error } = await db
    .from('annonces')
    .update({ statut: 'cloturee', motif_cloture: motif })
    .eq('id', annonce.id)
    .in('statut', ['publiee', 'suspendue'])
    .select('id')

  if (error) return refusBase(error)
  if (!data || data.length === 0) return refus('statut_change')
  return { ok: true }
}

/**
 * Supprimer un brouillon, et ses fichiers.
 *
 * La suppression de la ligne emporte ses lignes de photos par cascade, pas
 * leurs fichiers : on relève les chemins d'abord, on les retire du coffre
 * ensuite. Un fichier qui résiste reste privé et non référencé — signalé,
 * invisible.
 *
 * Sans cette porte, un brouillon créé par erreur empêcherait à jamais de
 * supprimer son logement (`annonces_logement_si_vivante`).
 */
export async function supprimerBrouillon(
  { db, stockage }: { db: Client; stockage: Client['storage'] },
  id: string,
): Promise<{ ok: true } | Refus> {
  if (!(await session(db))) return refus('non_autorise')
  const annonce = await lireAnnonce(db, id)
  if (!annonce) return refus('introuvable')
  if (annonce.statut !== 'brouillon') return refus('suppression_publiee')

  const { data: photos } = await db.from('annonce_photos').select('chemin').eq('annonce_id', annonce.id)

  const { data, error } = await db
    .from('annonces')
    .delete()
    .eq('id', annonce.id)
    .eq('statut', 'brouillon')
    .select('id')

  if (error) return refusBase(error)
  if (!data || data.length === 0) return refus('statut_change')

  const chemins = (photos ?? []).map((p) => p.chemin)
  if (chemins.length > 0) {
    const { error: erreurFichiers } = await stockage.from(BUCKET_PHOTOS_ANNONCES).remove(chemins)
    if (erreurFichiers) {
      console.error(`[annonces] fichiers orphelins après suppression du brouillon ${annonce.id}`)
    }
  }
  return { ok: true }
}
