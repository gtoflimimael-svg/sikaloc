'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { aujourdhuiISO } from '@/lib/format'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaBail, type EtatFormulaire } from '@/lib/validation'

function lireFormulaire(donnees: FormData) {
  return schemaBail.safeParse({
    logementId: donnees.get('logementId'),
    locataireId: donnees.get('locataireId'),
    loyerMensuel: donnees.get('loyerMensuel'),
    dateDebut: donnees.get('dateDebut'),
    dateFin: donnees.get('dateFin') || '',
    jourEcheance: donnees.get('jourEcheance'),
    toleranceJours: donnees.get('toleranceJours') || 5,
    depotGarantie: donnees.get('depotGarantie') || undefined,
  })
}

/** Traduit les erreurs Postgres en messages compréhensibles par un bailleur. */
function messageErreur(error: { code?: string; message: string }): string {
  if (error.code === '23505' && error.message.includes('baux_un_seul_actif_par_logement')) {
    return 'Ce logement porte déjà un bail actif. Résiliez-le avant d’en créer un nouveau.'
  }
  if (error.code === '23514') {
    // Les triggers de cohérence remontent avec ce code.
    return error.message.replace(/^.*?:\s*/, '')
  }
  return error.message
}

export async function creerBail(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  const { data, error } = await supabase
    .from('baux')
    .insert({
      bailleur_id: bailleur.id,
      logement_id: analyse.data.logementId,
      locataire_id: analyse.data.locataireId,
      loyer_mensuel: analyse.data.loyerMensuel,
      date_debut: analyse.data.dateDebut,
      date_fin: analyse.data.dateFin || null,
      jour_echeance: analyse.data.jourEcheance,
      tolerance_jours: analyse.data.toleranceJours,
      depot_garantie: analyse.data.depotGarantie ?? null,
      statut: 'Actif',
    })
    .select('id')
    .single()

  if (error) return { erreur: `Création impossible : ${messageErreur(error)}` }

  revalidatePath('/app/baux')
  revalidatePath('/app')
  redirect(`/app/baux/${data.id}`)
}

export async function modifierBail(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()

  const { error } = await supabase
    .from('baux')
    .update({
      logement_id: analyse.data.logementId,
      locataire_id: analyse.data.locataireId,
      loyer_mensuel: analyse.data.loyerMensuel,
      date_debut: analyse.data.dateDebut,
      date_fin: analyse.data.dateFin || null,
      jour_echeance: analyse.data.jourEcheance,
      tolerance_jours: analyse.data.toleranceJours,
      depot_garantie: analyse.data.depotGarantie ?? null,
    })
    .eq('id', id)

  if (error) return { erreur: `Mise à jour impossible : ${messageErreur(error)}` }

  revalidatePath('/app/baux')
  revalidatePath(`/app/baux/${id}`)
  redirect(`/app/baux/${id}`)
}

/**
 * Résiliation — §6.1.6 : passe le statut à « Résilié » et libère le logement.
 *
 * La date de fin est renseignée si elle ne l'était pas, pour que l'historique
 * reste lisible et que la détection d'impayés cesse au bon mois.
 */
export async function resilierBail(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()

  const { data: bail } = await supabase
    .from('baux')
    .select('date_fin')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('baux')
    .update({
      statut: 'Résilié',
      date_fin: bail?.date_fin ?? aujourdhuiISO(),
    })
    .eq('id', id)

  if (error) return { erreur: `Résiliation impossible : ${messageErreur(error)}` }

  revalidatePath('/app/baux')
  revalidatePath(`/app/baux/${id}`)
  revalidatePath('/app')
  return { succes: 'Bail résilié. Le logement est de nouveau disponible.' }
}

export async function reactiverBail(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()

  const { error } = await supabase
    .from('baux')
    .update({ statut: 'Actif', date_fin: null })
    .eq('id', id)

  if (error) return { erreur: `Réactivation impossible : ${messageErreur(error)}` }

  revalidatePath('/app/baux')
  revalidatePath(`/app/baux/${id}`)
  return { succes: 'Bail réactivé.' }
}

export async function supprimerBail(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('baux').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        erreur:
          'Ce bail porte des paiements enregistrés. Il ne peut pas être supprimé — résiliez-le plutôt.',
      }
    }
    return { erreur: `Suppression impossible : ${messageErreur(error)}` }
  }

  revalidatePath('/app/baux')
  redirect('/app/baux')
}
