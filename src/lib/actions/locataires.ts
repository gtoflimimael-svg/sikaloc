'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { aujourdhuiISO } from '@/lib/format'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaLocataire, type EtatFormulaire } from '@/lib/validation'

function lireFormulaire(donnees: FormData) {
  return schemaLocataire.safeParse({
    nom: donnees.get('nom'),
    telephone: donnees.get('telephone'),
    email: donnees.get('email') ?? '',
    consentement: donnees.get('consentement') === 'on' || donnees.get('consentement') === 'true',
    avatar: donnees.get('avatar') ?? '',
  })
}

export async function creerLocataire(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  const { error } = await supabase.from('locataires').insert({
    bailleur_id: bailleur.id,
    nom: analyse.data.nom,
    telephone: analyse.data.telephone,
    email: analyse.data.email || null,
    consentement_donnees: true,
    date_consentement: aujourdhuiISO(),
    avatar: analyse.data.avatar || null,
  })

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  revalidatePath('/app/locataires')
  redirect('/app/locataires')
}

export async function modifierLocataire(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()

  // Pas de filtre sur bailleur_id : les RLS s'en chargent, et un id volé
  // renverrait simplement zéro ligne modifiée.
  const { error } = await supabase
    .from('locataires')
    .update({
      nom: analyse.data.nom,
      telephone: analyse.data.telephone,
      email: analyse.data.email || null,
      avatar: analyse.data.avatar || null,
    })
    .eq('id', id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  revalidatePath('/app/locataires')
  redirect('/app/locataires')
}

export async function supprimerLocataire(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('locataires').delete().eq('id', id)

  if (error) {
    // FK RESTRICT depuis `baux` : un locataire sous bail n'est pas supprimable.
    if (error.code === '23503') {
      return {
        erreur:
          'Ce locataire est rattaché à un bail. Résiliez puis supprimez le bail avant de le retirer.',
      }
    }
    return { erreur: `Suppression impossible : ${error.message}` }
  }

  revalidatePath('/app/locataires')
  return { succes: 'Locataire supprimé.' }
}
