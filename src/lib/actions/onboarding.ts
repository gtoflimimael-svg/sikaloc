'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaOnboarding, type EtatFormulaire } from '@/lib/validation'

/**
 * Clôture de l'onboarding guidé (§6.1.2).
 *
 * Les trois entités sont créées par la fonction `creer_premier_bail`, dans une
 * seule transaction : un bailleur ne doit pas se retrouver avec un locataire
 * enregistré et pas de bail parce que la troisième écriture a échoué.
 */
export async function terminerOnboarding(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaOnboarding.safeParse({
    locataireNom: donnees.get('locataireNom'),
    locataireTelephone: donnees.get('locataireTelephone'),
    consentement:
      donnees.get('consentement') === 'on' || donnees.get('consentement') === 'true',
    logementAdresse: donnees.get('logementAdresse'),
    logementVille: donnees.get('logementVille'),
    logementType: donnees.get('logementType') || 'Appartement',
    loyerMensuel: donnees.get('loyerMensuel'),
    jourEcheance: donnees.get('jourEcheance'),
    dateDebut: donnees.get('dateDebut'),
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  await bailleurCourant()
  const supabase = await creerClientServeur()

  const { error } = await supabase.rpc('creer_premier_bail', {
    p_locataire_nom: analyse.data.locataireNom,
    p_locataire_telephone: analyse.data.locataireTelephone,
    p_logement_adresse: analyse.data.logementAdresse,
    p_logement_ville: analyse.data.logementVille,
    p_logement_type: analyse.data.logementType,
    p_loyer_mensuel: analyse.data.loyerMensuel,
    p_jour_echeance: analyse.data.jourEcheance,
    p_date_debut: analyse.data.dateDebut,
  })

  if (error) return { erreur: `La configuration a échoué : ${error.message}` }

  revalidatePath('/app', 'layout')
  redirect('/app?bienvenue=1')
}

/** Permet de sauter l'onboarding et d'arriver sur un tableau de bord vide. */
export async function ignorerOnboarding(): Promise<void> {
  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  await supabase
    .from('bailleurs')
    .update({ onboarding_termine: true })
    .eq('id', bailleur.id)

  revalidatePath('/app', 'layout')
  redirect('/app')
}
