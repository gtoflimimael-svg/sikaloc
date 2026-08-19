import { redirect } from 'next/navigation'

import { droits, MESSAGE_ECRITURE_BLOQUEE } from '@/lib/acces'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Bailleur } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Profil du bailleur connecté.
 *
 * Redirige vers la connexion si la session est absente ou si le profil n'a pas
 * pu être lu — un utilisateur authentifié sans ligne dans `bailleurs` est un
 * état incohérent qu'on ne laisse pas entrer dans l'application.
 */
export async function bailleurCourant(): Promise<Bailleur> {
  const supabase = await creerClientServeur()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { data: bailleur } = await supabase
    .from('bailleurs')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!bailleur) redirect('/connexion')

  return bailleur as Bailleur
}

/**
 * Variante qui impose d'avoir terminé l'onboarding.
 *
 * Utilisée par toutes les pages de l'app sauf l'onboarding lui-même : un
 * bailleur sans bail n'a rien à faire sur un tableau de bord vide.
 */
export async function bailleurOnboarde(): Promise<Bailleur> {
  const bailleur = await bailleurCourant()

  if (!bailleur.onboarding_termine) redirect('/app/onboarding')

  return bailleur
}

/**
 * Bailleur autorisé à écrire — garde-fou du cycle de grâce (v2.1 §4.4).
 *
 * À appeler en tête de toute Server Action qui crée ou modifie une donnée
 * métier. Le contrôle vit ici plutôt que dans les formulaires : masquer un
 * bouton n'empêche personne de rejouer la requête, alors que ce point de
 * passage est sur le chemin de toutes les écritures.
 *
 * Retourne un résultat plutôt que de lever une exception : une exception dans
 * une Server Action se traduirait par une erreur 500 opaque, là où le bailleur
 * doit lire pourquoi son enregistrement est refusé.
 */
export async function bailleurAvecEcriture(): Promise<
  { ok: true; bailleur: Bailleur } | { ok: false; etat: EtatFormulaire }
> {
  const bailleur = await bailleurOnboarde()

  if (!droits(bailleur).peutEcrire) {
    return { ok: false, etat: { erreur: MESSAGE_ECRITURE_BLOQUEE } }
  }

  return { ok: true, bailleur }
}
