'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { ESPACE_PRO } from '@/lib/roles'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Clôture de l'onboarding.
 *
 * ─── Ce que cet assistant ne fait plus ──────────────────────────────────────
 *
 * Il exigeait de créer un locataire, un logement et un bail avant de donner
 * accès au tableau de bord — quatre étapes, dont deux qui demandaient d'avoir
 * un vrai locataire sous la main. Quelqu'un qui découvre Sikaloc n'a pas
 * forcément ces informations au moment où il s'inscrit, et l'obliger à les
 * inventer pour continuer produit des données fausses dès la première minute.
 *
 * Restent deux étapes : le récapitulatif de l'activité et la signature, toutes
 * deux facultatives. Le didacticiel du tableau de bord prend ensuite le relais
 * pour montrer où ajouter un logement, un locataire, un bail.
 *
 * La fonction `creer_premier_bail` n'est plus appelée d'ici. Elle reste en base
 * : elle crée les trois entités dans une seule transaction, ce qui redeviendra
 * utile si un parcours guidé est proposé plus tard depuis le tableau de bord.
 */
export async function terminerOnboarding(
  _etat: EtatFormulaire,
  _donnees: FormData,
): Promise<EtatFormulaire> {
  return marquerTermineEtRediriger()
}

/**
 * Saut de l'onboarding.
 *
 * Même destination que la clôture normale, didacticiel compris : quelqu'un qui
 * passe l'assistant en a plus besoin, pas moins.
 */
export async function ignorerOnboarding(
  _etat: EtatFormulaire,
  _donnees: FormData,
): Promise<EtatFormulaire> {
  return marquerTermineEtRediriger()
}

async function marquerTermineEtRediriger(): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  let termine = false
  try {
    const supabase = await creerClientServeur()
    const { data, error } = await supabase
      .from('bailleurs')
      .update({ onboarding_termine: true })
      .eq('id', bailleur.id)
      .select('onboarding_termine')
      .single()

    termine = !error && data?.onboarding_termine === true
  } catch {
    termine = false
  }

  if (!termine) {
    return { erreur: 'Impossible de terminer la configuration. Réessayez.' }
  }

  revalidatePath('/pro', 'layout')
  redirect(`${ESPACE_PRO.tableauDeBord}?bienvenue=1`)
}

/**
 * Mémorise que le didacticiel a été vu.
 *
 * Appelée à sa fermeture, quelle qu'en soit la façon — bouton, Échap, ou
 * parcours mené jusqu'au bout. Ne redirige pas : l'utilisateur est déjà là où
 * il doit être.
 */
export async function marquerTutorielVu(): Promise<void> {
  const bailleur = await bailleurCourant()
  if (bailleur.tutoriel_vu_le) return

  const supabase = await creerClientServeur()

  await supabase
    .from('bailleurs')
    .update({ tutoriel_vu_le: new Date().toISOString() })
    .eq('id', bailleur.id)

  revalidatePath(ESPACE_PRO.tableauDeBord)
}
