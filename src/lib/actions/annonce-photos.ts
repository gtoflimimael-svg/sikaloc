'use server'

import { revalidatePath } from 'next/cache'

import { deposerPhotoAnnonce, retirerPhotoAnnonce } from '@/lib/annonces/depot-photos'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Photos d'annonce — les points d'entrée serveur.
 *
 * Minces à dessein : toute la logique vit dans `lib/annonces/depot-photos.ts`,
 * où le banc l'exerce avec de vraies sessions. Ici, seulement la porte :
 * un bailleur qui peut écrire, un fichier, un message.
 *
 * Le client n'envoie jamais de chemin ni de bailleur : un identifiant
 * d'annonce (lié côté serveur par `bind`), un fichier, rien d'autre.
 */

export async function ajouterPhotoAnnonce(
  annonceId: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const fichier = donnees.get('photo')
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Choisissez une photo.' }
  }

  const resultat = await deposerPhotoAnnonce(
    { db: await creerClientServeur(), stockage: creerClientAdmin().storage },
    annonceId,
    fichier,
  )
  if (!resultat.ok) return { erreur: resultat.message }

  revalidatePath(`/pro/annonces/${annonceId}`)
  revalidatePath('/pro/annonces')
  return { succes: 'Photo ajoutée.' }
}

export async function retirerPhotoAnnonceAction(photoId: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await retirerPhotoAnnonce(
    { db: await creerClientServeur(), stockage: creerClientAdmin().storage },
    photoId,
  )
  if (!resultat.ok) return { erreur: resultat.message }

  revalidatePath('/pro/annonces', 'layout')
  return { succes: 'Photo retirée.' }
}
