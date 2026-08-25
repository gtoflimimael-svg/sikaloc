'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

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
export async function terminerOnboarding(): Promise<void> {
  await marquerTermine()
  redirect('/app?bienvenue=1')
}

/**
 * Saut de l'onboarding.
 *
 * Même destination que la clôture normale, didacticiel compris : quelqu'un qui
 * passe l'assistant en a plus besoin, pas moins.
 */
export async function ignorerOnboarding(): Promise<void> {
  await marquerTermine()
  redirect('/app?bienvenue=1')
}

async function marquerTermine(): Promise<void> {
  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  await supabase
    .from('bailleurs')
    .update({ onboarding_termine: true })
    .eq('id', bailleur.id)

  revalidatePath('/app', 'layout')
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

  revalidatePath('/app')
}
