import { redirect } from 'next/navigation'

import { droits, MESSAGE_ECRITURE_BLOQUEE } from '@/lib/acces'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Bailleur } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'
import { etatVerification } from '@/lib/verification/etat'

/**
 * Identité du bailleur connecté, SANS contrôle de vérification.
 *
 * Réservé aux écrans de vérification eux-mêmes, qui doivent pouvoir lire le
 * profil d'un compte précisément pas encore vérifié. Partout ailleurs, c'est
 * `bailleurCourant()` qu'il faut appeler.
 *
 * Redirige vers la connexion si la session est absente ou si le profil n'a pas
 * pu être lu — un utilisateur authentifié sans ligne dans `bailleurs` est un
 * état incohérent qu'on ne laisse pas entrer dans l'application.
 */
export async function bailleurNonVerifie(): Promise<Bailleur> {
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
 * Profil du bailleur connecté, dont les deux coordonnées sont vérifiées.
 *
 * ─── Pourquoi le contrôle est ICI ───────────────────────────────────────────
 *
 * Parce que c'est le seul endroit par lequel tout passe. Les six modules
 * d'actions serveur et les trois mises en page de l'application appellent
 * cette fonction ; aucun n'a besoin d'être modifié pour hériter de la règle.
 *
 * L'alternative — poser le contrôle dans `bailleurOnboarde()` ou dans chaque
 * action — reproduirait exactement la dette du cycle de grâce, appliqué à
 * 4 actions serveur sur 18. Une règle de sécurité qu'il faut se souvenir
 * d'appeler n'est pas une règle, c'est une intention.
 *
 * ─── Ce que le navigateur n'y change rien ───────────────────────────────────
 *
 * Masquer un écran n'empêche personne de rejouer la requête. Ce contrôle-ci
 * s'exécute sur le serveur, avant toute lecture et toute écriture métier : un
 * compte dont seul l'email est vérifié n'atteint aucune donnée, quelle que soit
 * la façon dont la requête a été fabriquée.
 */
export async function bailleurCourant(): Promise<Bailleur> {
  const bailleur = await bailleurNonVerifie()

  const etat = await etatVerification(bailleur)
  if (!etat.pleinementVerifie) redirect('/verification')

  return bailleur
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
