'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  changerStatut,
  cloturerAnnonce as cloturer,
  creerBrouillon,
  modifierAnnonce,
  supprimerBrouillon,
  type MotifClotureManuelle,
  type Transition,
} from '@/lib/annonces/gestion'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaAnnonce, type EtatFormulaire } from '@/lib/validation'

/**
 * Annonces Sikaloc_Find — les points d'entrée de l'espace Pro.
 *
 * Minces : chacune vérifie que le bailleur peut écrire (compte en lecture
 * seule refusé, comme partout dans Pro), puis délègue à
 * `lib/annonces/gestion.ts`. Aucune ne reçoit de `bailleur_id` : l'identité
 * est celle de la session.
 */

function revalider(id?: string) {
  revalidatePath('/pro/annonces')
  if (id) revalidatePath(`/pro/annonces/${id}`)
  revalidatePath('/pro/logements')
}

export async function creerAnnonce(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const logementId = String(donnees.get('logementId') ?? '')
  if (!logementId) return { erreursChamps: { logementId: 'Choisissez un logement.' } }

  const resultat = await creerBrouillon(await creerClientServeur(), logementId)
  if (!resultat.ok) return { erreur: resultat.message }

  revalider(resultat.id)
  redirect(`/pro/annonces/${resultat.id}${resultat.existante ? '?existante=1' : ''}`)
}

export async function enregistrerAnnonce(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaAnnonce.safeParse({
    ville: donnees.get('ville'),
    quartier: donnees.get('quartier'),
    chambres: donnees.get('chambres'),
    surfaceM2: donnees.get('surfaceM2'),
    loyer: donnees.get('loyer'),
    charges: donnees.get('charges'),
    depotGarantie: donnees.get('depotGarantie'),
    avanceMois: donnees.get('avanceMois'),
    equipements: donnees.getAll('equipements'),
    description: donnees.get('description'),
    disponibleLe: donnees.get('disponibleLe'),
  })
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await modifierAnnonce(await creerClientServeur(), id, analyse.data)
  if (!resultat.ok) return { erreur: resultat.message }

  revalider(id)
  return { succes: 'Annonce enregistrée.' }
}

async function transition(id: string, laquelle: Transition, succes: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await changerStatut(await creerClientServeur(), id, laquelle)
  if (!resultat.ok) return { erreur: resultat.message }

  revalider(id)
  return { succes }
}

export async function publierAnnonce(id: string): Promise<EtatFormulaire> {
  return transition(id, 'publier', 'Annonce publiée.')
}

export async function suspendreAnnonce(id: string): Promise<EtatFormulaire> {
  return transition(id, 'suspendre', 'Annonce suspendue.')
}

export async function reprendreAnnonce(id: string): Promise<EtatFormulaire> {
  return transition(id, 'reprendre', 'Annonce de nouveau publiée.')
}

export async function cloturerAnnonce(id: string, motif: MotifClotureManuelle): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await cloturer(await creerClientServeur(), id, motif)
  if (!resultat.ok) return { erreur: resultat.message }

  revalider(id)
  return { succes: 'Annonce clôturée.' }
}

export async function supprimerAnnonceBrouillon(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await supprimerBrouillon(
    { db: await creerClientServeur(), stockage: creerClientAdmin().storage },
    id,
  )
  if (!resultat.ok) return { erreur: resultat.message }

  revalider()
  redirect('/pro/annonces')
}
