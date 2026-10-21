import 'server-only'

import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { POIDS_MAX_PHOTO, traiterPhotoAnnonce, type MotifRefusPhoto, MESSAGES_PHOTO } from '@/lib/annonces/photos'
import type { AnnoncePhoto, Database } from '@/lib/types/database'

/**
 * Dépôt et retrait des photos d'annonce.
 *
 * ─── Deux clients, deux rôles ──────────────────────────────────────────────
 *
 * `db` porte la SESSION du bailleur. Tout ce qui décide — à qui est cette
 * annonce, quelles positions sont prises, l'écriture de la ligne — passe par
 * lui, donc par les politiques de S1. Un bailleur ne lit que ses annonces :
 * celle d'un autre est introuvable, sans qu'on ait à le vérifier à la main.
 *
 * `stockage` est celui de la clé de service. Le bucket `annonces` n'a AUCUNE
 * politique : ni un visiteur ni un bailleur connecté ne peuvent y lire ou y
 * déposer quoi que ce soit directement. C'est ce qui garantit que tout fichier
 * du bucket est passé par `traiterPhotoAnnonce` — un navigateur qui y
 * écrirait lui-même y déposerait l'original, EXIF compris. La clé de service
 * n'écrit qu'après que la session a établi le droit de le faire.
 *
 * ─── Le chemin ─────────────────────────────────────────────────────────────
 *
 * Construit ici, jamais reçu : bailleur et annonce viennent de la ligne lue
 * par la session, le nom de fichier d'un UUID. Le client ne transmet qu'un
 * identifiant d'annonce et un fichier.
 */

export const BUCKET_PHOTOS_ANNONCES = 'annonces'

/** 8 photos, positions 0 à 7 — les bornes de S1. */
export const PHOTOS_MAX_PAR_ANNONCE = 8

type Client = SupabaseClient<Database>

export type ContexteDepot = {
  /** Client à la session du bailleur. */
  db: Client
  /** Stockage à la clé de service. */
  stockage: Client['storage']
}

export type MotifRefusDepot =
  | MotifRefusPhoto
  | 'non_authentifie'
  | 'introuvable'
  | 'annonce_cloturee'
  | 'complet'
  | 'stockage'
  | 'enregistrement'

export type MotifRefusRetrait =
  | 'non_authentifie'
  | 'introuvable'
  | 'derniere_photo'
  | 'enregistrement'

const MESSAGES: Record<Exclude<MotifRefusDepot, MotifRefusPhoto> | MotifRefusRetrait, string> = {
  non_authentifie: 'Connectez-vous pour gérer les photos de vos annonces.',
  introuvable: 'Cette annonce est introuvable.',
  annonce_cloturee: 'Cette annonce est clôturée : ses photos ne se modifient plus.',
  complet: `Une annonce compte ${PHOTOS_MAX_PAR_ANNONCE} photos au plus. Retirez-en une pour en ajouter une autre.`,
  stockage: 'La photo n’a pas pu être enregistrée. Réessayez dans un instant.',
  enregistrement: 'La photo n’a pas pu être enregistrée. Réessayez dans un instant.',
  derniere_photo:
    'Une annonce publiée garde au moins une photo : ajoutez-en une autre avant de retirer celle-ci.',
}

const messageDe = (motif: MotifRefusDepot | MotifRefusRetrait) =>
  motif in MESSAGES_PHOTO
    ? MESSAGES_PHOTO[motif as MotifRefusPhoto]
    : MESSAGES[motif as Exclude<MotifRefusDepot, MotifRefusPhoto>]

export type ResultatDepot =
  | { ok: true; photo: AnnoncePhoto }
  | { ok: false; motif: MotifRefusDepot; message: string }

export type ResultatRetrait =
  | { ok: true; fichierOrphelin: boolean }
  | { ok: false; motif: MotifRefusRetrait; message: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Autant d'essais que de positions, et de la marge : chaque échec n'arrive
 * que si un dépôt concurrent vient de prendre la place visée.
 */
const ESSAIS_POSITION = PHOTOS_MAX_PAR_ANNONCE * 2

async function positionsPrises(db: Client, annonceId: string): Promise<Set<number> | null> {
  const { data, error } = await db
    .from('annonce_photos')
    .select('position')
    .eq('annonce_id', annonceId)
  if (error) return null
  return new Set(data.map((p) => p.position))
}

const premiereLibre = (prises: Set<number>) =>
  Array.from({ length: PHOTOS_MAX_PAR_ANNONCE }, (_, i) => i).find((p) => !prises.has(p))

/**
 * Ajoute une photo à une annonce du bailleur connecté.
 *
 * Ordre des opérations, et pourquoi :
 *
 *   1. droits (session, annonce, statut, place restante) — avant de lire le
 *      fichier, pour ne pas traiter une image qu'on refusera ;
 *   2. traitement — rien n'est écrit tant que l'image n'est pas propre ;
 *   3. fichier, PUIS ligne. Une ligne sans fichier serait une photo cassée
 *      dans une annonce publique ; un fichier sans ligne n'est qu'un objet
 *      privé que personne ne référence. Et ce fichier-là, on le retire dès
 *      que la ligne échoue.
 *
 * La position n'est pas calculée une fois pour toutes : la contrainte
 * `annonce_photos_position_unique` est l'arbitre. Deux dépôts simultanés
 * visent la même place, l'un gagne, l'autre relit les positions et prend la
 * suivante. Une neuvième photo ne trouve aucune place, et son fichier est
 * retiré.
 */
export async function deposerPhotoAnnonce(
  { db, stockage }: ContexteDepot,
  annonceId: string,
  fichier: Blob,
  options: { poidsSortieMax?: number } = {},
): Promise<ResultatDepot> {
  const refus = (motif: MotifRefusDepot): ResultatDepot => ({ ok: false, motif, message: messageDe(motif) })

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return refus('non_authentifie')

  if (!UUID.test(annonceId)) return refus('introuvable')

  // La politique de lecture ne rend que les annonces de l'appelant : celle
  // d'un autre bailleur est introuvable, exactement comme une annonce qui
  // n'existe pas. La comparaison explicite double la politique, elle ne la
  // remplace pas.
  const { data: annonce } = await db
    .from('annonces')
    .select('id, bailleur_id, statut')
    .eq('id', annonceId)
    .maybeSingle()
  if (!annonce || annonce.bailleur_id !== user.id) return refus('introuvable')

  // Brouillon, publiée et suspendue acceptent des photos : une annonce en
  // pause reste l'annonce de son bailleur, qui la prépare à revenir. Une
  // annonce clôturée est une archive.
  if (annonce.statut === 'cloturee') return refus('annonce_cloturee')

  const prises = await positionsPrises(db, annonce.id)
  if (!prises) return refus('enregistrement')
  if (prises.size >= PHOTOS_MAX_PAR_ANNONCE) return refus('complet')

  // Le poids d'abord, sans lire le fichier : un envoi de 3 Go ne doit pas
  // finir en mémoire pour y être mesuré.
  if (fichier.size > POIDS_MAX_PHOTO) return refus('trop_lourde')

  const traitee = await traiterPhotoAnnonce(Buffer.from(await fichier.arrayBuffer()), options)
  if (!traitee.ok) return refus(traitee.motif)

  const chemin = `${annonce.bailleur_id}/${annonce.id}/${randomUUID()}.${traitee.extension}`

  const { error: erreurDepot } = await stockage
    .from(BUCKET_PHOTOS_ANNONCES)
    .upload(chemin, traitee.donnees, { contentType: traitee.typeMime, upsert: false })
  if (erreurDepot) return refus('stockage')

  const retirerFichier = async () => {
    const { error } = await stockage.from(BUCKET_PHOTOS_ANNONCES).remove([chemin])
    if (error) console.error(`[photos] fichier orphelin non retiré : ${chemin} — ${error.message}`)
  }

  try {
    for (let essai = 0; essai < ESSAIS_POSITION; essai++) {
      const actuelles = await positionsPrises(db, annonce.id)
      if (!actuelles) break
      const position = premiereLibre(actuelles)
      if (position === undefined) {
        await retirerFichier()
        return refus('complet')
      }

      const { data: photo, error } = await db
        .from('annonce_photos')
        .insert({
          annonce_id: annonce.id,
          bailleur_id: annonce.bailleur_id,
          chemin,
          position,
          largeur: traitee.largeur,
          hauteur: traitee.hauteur,
          type_mime: traitee.typeMime,
          poids: traitee.poids,
        })
        .select()
        .single()

      if (!error) return { ok: true, photo }
      // Place prise entre la lecture et l'écriture : on relit, on réessaie.
      if (error.code === '23505') continue
      break
    }
  } catch (e) {
    console.error('[photos] enregistrement interrompu', e)
  }

  await retirerFichier()
  return refus('enregistrement')
}

/**
 * Retire une photo d'une annonce du bailleur connecté.
 *
 * La ligne d'abord, le fichier ensuite. Dans l'autre ordre, un échec entre
 * les deux laisserait une ligne pointant vers un fichier disparu — une image
 * cassée, peut-être sur une annonce publique. Dans celui-ci, le pire est un
 * fichier privé que plus rien ne référence : il est signalé, et invisible.
 *
 * La dernière photo d'une annonce publiée ne part pas : c'est le déclencheur
 * `proteger_derniere_photo` qui refuse, pas ce code.
 *
 * Si la photo retirée était la principale (position 0), la suivante prend sa
 * place : une annonce qui a des photos a toujours une photo principale.
 */
export async function retirerPhotoAnnonce(
  { db, stockage }: ContexteDepot,
  photoId: string,
): Promise<ResultatRetrait> {
  const refus = (motif: MotifRefusRetrait): ResultatRetrait => ({ ok: false, motif, message: messageDe(motif) })

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return refus('non_authentifie')
  if (!UUID.test(photoId)) return refus('introuvable')

  const { data: photo } = await db
    .from('annonce_photos')
    .select('id, annonce_id, bailleur_id, chemin, position')
    .eq('id', photoId)
    .maybeSingle()
  if (!photo || photo.bailleur_id !== user.id) return refus('introuvable')

  const { data: supprimees, error } = await db
    .from('annonce_photos')
    .delete()
    .eq('id', photo.id)
    .select('id')
  if (error) return refus(error.code === '23514' ? 'derniere_photo' : 'enregistrement')
  if (!supprimees || supprimees.length === 0) return refus('introuvable')

  if (photo.position === 0) {
    const { data: suivante } = await db
      .from('annonce_photos')
      .select('id')
      .eq('annonce_id', photo.annonce_id)
      .order('position')
      .limit(1)
      .maybeSingle()
    if (suivante) {
      const { error: erreurPromotion } = await db
        .from('annonce_photos')
        .update({ position: 0 })
        .eq('id', suivante.id)
      if (erreurPromotion) {
        console.error(`[photos] photo principale non remplacée : annonce ${photo.annonce_id}`)
      }
    }
  }

  const { error: erreurFichier } = await stockage.from(BUCKET_PHOTOS_ANNONCES).remove([photo.chemin])
  if (erreurFichier) {
    console.error(`[photos] fichier orphelin après retrait : ${photo.chemin} — ${erreurFichier.message}`)
    return { ok: true, fichierOrphelin: true }
  }
  return { ok: true, fichierOrphelin: false }
}
