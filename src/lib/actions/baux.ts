'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaBail, type EtatFormulaire } from '@/lib/validation'
import { ESPACE_PRO } from '@/lib/roles'

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

  revalidatePath('/pro/baux')
  revalidatePath(ESPACE_PRO.tableauDeBord)

  // ── Le bail a-t-il commencé avant d'être enregistré ? ────────────────────
  //
  // La question n'est pas « la date de début est-elle passée ? » mais « des
  // échéances étaient-elles déjà échues, au sens de la règle de ce bail, quand
  // Sikaloc l'a appris ? ». C'est `v_echeances` qui le sait — la même vue qui
  // décide des impayés. La recalculer ici produirait un second jeu de règles.
  //
  // Sans cette étape, ces mois resteraient « À déterminer » indéfiniment : ils
  // ne seraient réclamés à personne, ce qui est correct, mais le bailleur ne
  // saurait pas qu'on l'attend.
  const { count: aDeterminer } = await supabase
    .from('v_echeances')
    .select('periode_debut', { count: 'exact', head: true })
    .eq('bail_id', data.id)
    .eq('etat', 'À déterminer')

  if ((aDeterminer ?? 0) > 0) redirect(`/pro/baux/${data.id}/historique`)

  redirect(`/pro/baux/${data.id}`)
}

export async function modifierBail(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()

  const { data: modifie, error } = await supabase
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
    .eq('bailleur_id', acces.bailleur.id)
    .select('id')
    .maybeSingle()

  if (error) return { erreur: `Mise à jour impossible : ${messageErreur(error)}` }
  if (!modifie) return { erreur: 'Modification impossible : bail introuvable ou non autorisé.' }

  revalidatePath('/pro/baux')
  revalidatePath(`/pro/baux/${id}`)
  redirect(`/pro/baux/${id}`)
}

/**
 * Résiliation — §6.1.6 : passe le statut à « Résilié » et libère le logement.
 *
 * La date de fin est renseignée si elle ne l'était pas, pour que l'historique
 * reste lisible et que la détection d'impayés cesse au bon mois.
 */
export async function resilierBail(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()

  const { data: statut, error } = await supabase.rpc('definir_statut_bail', {
    p_bail_id: id,
    p_statut: 'Résilié',
  })

  if (error) return { erreur: `Résiliation impossible : ${messageErreur(error)}` }
  if (statut !== 'Résilié') return { erreur: 'Résiliation impossible : bail introuvable ou non autorisé.' }

  revalidatePath('/pro/baux')
  revalidatePath(`/pro/baux/${id}`)
  revalidatePath(ESPACE_PRO.tableauDeBord)
  return { succes: 'Bail résilié. Le logement est de nouveau disponible.' }
}

export async function reactiverBail(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()

  const { data: statut, error } = await supabase.rpc('definir_statut_bail', {
    p_bail_id: id,
    p_statut: 'Actif',
  })

  if (error) return { erreur: `Réactivation impossible : ${messageErreur(error)}` }
  if (statut !== 'Actif') return { erreur: 'Réactivation impossible : bail introuvable ou non autorisé.' }

  revalidatePath('/pro/baux')
  revalidatePath(`/pro/baux/${id}`)
  return { succes: 'Bail réactivé.' }
}

export async function supprimerBail(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()
  const { data: supprime, error } = await supabase.from('baux').delete()
    .eq('id', id).eq('bailleur_id', acces.bailleur.id).select('id').maybeSingle()

  if (error) {
    if (error.code === '23503') {
      return {
        erreur:
          'Ce bail porte des paiements enregistrés. Il ne peut pas être supprimé — résiliez-le plutôt.',
      }
    }
    return { erreur: `Suppression impossible : ${messageErreur(error)}` }
  }

  if (!supprime) return { erreur: 'Suppression impossible : bail introuvable ou non autorisé.' }

  revalidatePath('/pro/baux')
  redirect('/pro/baux')
}
