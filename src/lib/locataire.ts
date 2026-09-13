import 'server-only'

import { cache } from 'react'

import { creerClientServeur } from '@/lib/supabase/serveur'
import type {
  BailLocataire,
  EcheanceLocataire,
  EtatEcheance,
  PaiementLocataire,
  QuittanceLocataire,
} from '@/lib/types/database'

/**
 * Ce que Sikaloc_Me lit, et comment il le présente.
 *
 * ─── Tout passe par les fonctions de la base ────────────────────────────────
 *
 * Aucune requête `.from('baux')` ici, et c'est délibéré : les politiques de
 * `baux` ne rendent que les lignes du bailleur propriétaire, un locataire n'y
 * lirait rien. Les cinq fonctions de la migration 20260913000700 sont l'unique
 * chemin, et elles déduisent l'appelant de sa session.
 *
 * Corollaire : aucune de ces fonctions ne prend d'identifiant de locataire en
 * argument. Il n'y a donc rien à falsifier dans une requête — pas de
 * `?locataire_id=` à deviner, pas de paramètre à contrôler. C'est ce qui rend
 * ce module court.
 *
 * ─── Ce module ne recalcule aucun état ──────────────────────────────────────
 *
 * L'état d'une échéance vient de `v_echeances`, comme pour le bailleur. Le
 * refaire ici produirait deux calculs qui finiraient par diverger, et le
 * locataire lirait l'inverse de ce que son bailleur voit.
 */

// ═══ Lectures ════════════════════════════════════════════════════════════════
//
// Les trois listes passent par `cache()` de React : la mise en page de
// Sikaloc_Me lit les baux pour nommer le logement dans l'en-tête, et la page
// qu'elle enveloppe les relit pour les afficher. Sans cette mémorisation, la
// même requête partirait deux fois à chaque navigation.
//
// La portée est celle d'une requête HTTP, jamais plus : deux locataires
// simultanés ne partagent rien.

export const mesBaux = cache(async (): Promise<BailLocataire[]> => {
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('mes_baux')
  return data ?? []
})

export const mesEcheances = cache(async (): Promise<EcheanceLocataire[]> => {
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('mes_echeances')
  return data ?? []
})

export const mesPaiements = cache(async (): Promise<PaiementLocataire[]> => {
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('mes_paiements')
  return data ?? []
})

/**
 * Une quittance de l'appelant — ou `null` si elle ne le concerne pas.
 *
 * Rend le chemin du fichier : réservé au serveur qui le sert. Ne jamais passer
 * cet objet tel quel à un composant client.
 */
export async function maQuittance(id: string): Promise<QuittanceLocataire | null> {
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('ma_quittance', { p_quittance_id: id })
  return data?.[0] ?? null
}

// ═══ Présentation ════════════════════════════════════════════════════════════

/**
 * Ce que chaque état veut dire, dit au locataire.
 *
 * Les libellés eux-mêmes ne changent pas d'un espace à l'autre — un « Impayé »
 * doit être le même mot des deux côtés, sinon bailleur et locataire parlent de
 * deux choses en croyant parler de la même. Ce sont les explications qui
 * diffèrent, parce que la question n'est pas la même : le bailleur se demande
 * qui relancer, le locataire se demande ce qu'il doit.
 */
export const EXPLICATION_ETAT: Record<EtatEcheance, string> = {
  Réglé: 'Votre bailleur a enregistré le règlement de ce mois.',
  'À venir': 'Ce loyer n’est pas encore exigible.',
  Impayé:
    'Aucun règlement n’est enregistré pour ce mois et l’échéance est passée. ' +
    'Si vous avez payé, signalez-le à votre bailleur : lui seul peut ' +
    'l’enregistrer.',
  // Le message le plus important de l'écran. Voir le commentaire ci-dessous.
  'À déterminer':
    'Ce mois précède l’arrivée de votre bailleur sur Sikaloc, et il ne s’est ' +
    'pas encore prononcé dessus. Ce n’est pas un impayé : Sikaloc n’en sait ' +
    'simplement rien.',
}

/**
 * Les états qui appellent l'attention du locataire, dans l'ordre d'urgence.
 *
 * `À déterminer` n'en fait pas partie, et c'est le cœur du sujet.
 *
 * Un locataire qui a réglé deux ans de loyer en espèces avant que son bailleur
 * n'ouvre Sikaloc ne doit pas découvrir vingt-quatre mois marqués « Impayé » le
 * jour où il reçoit son invitation. Il ne les doit pas. Le quatrième état
 * existait déjà pour éviter au bailleur de réclamer un loyer déjà versé ; il
 * protège ici la personne à qui on l'aurait réclamé.
 */
export const ETATS_A_SIGNALER: EtatEcheance[] = ['Impayé']

/** Les échéances réellement dues, tous baux confondus. */
export function echeancesEnRetard(echeances: EcheanceLocataire[]): EcheanceLocataire[] {
  return echeances
    .filter((e) => e.etat === 'Impayé')
    .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))
}

/** Les mois sur lesquels le bailleur ne s'est pas prononcé. */
export function echeancesIndeterminees(echeances: EcheanceLocataire[]): EcheanceLocataire[] {
  return echeances
    .filter((e) => e.etat === 'À déterminer')
    .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))
}

/**
 * La prochaine échéance à honorer, pour un bail donné.
 *
 * La plus ancienne qui n'est ni réglée ni indéterminée : un retard de mars se
 * règle avant le loyer d'octobre. Rend `null` quand tout est à jour et que le
 * bail n'a plus de mois à venir.
 */
export function prochaineEcheance(
  echeances: EcheanceLocataire[],
  bailId: string,
): EcheanceLocataire | null {
  return (
    echeances
      .filter((e) => e.bail_id === bailId)
      .filter((e) => e.etat === 'Impayé' || e.etat === 'À venir')
      .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))[0] ?? null
  )
}

/** Le total réellement dû pour un bail — les mois « à déterminer » n'y entrent pas. */
export function resteADevoir(echeances: EcheanceLocataire[], bailId: string): number {
  return echeances
    .filter((e) => e.bail_id === bailId && e.etat === 'Impayé')
    .reduce((somme, e) => somme + Number(e.montant_du), 0)
}

/**
 * Les échéances d'un bail, groupées par année, la plus récente en tête.
 *
 * Un bail de cinq ans fait soixante lignes. À plat, c'est illisible ; par
 * année, la page redevient parcourable et l'année en cours est en haut.
 */
export function parAnneeDecroissante(
  echeances: EcheanceLocataire[],
): { annee: string; mois: EcheanceLocataire[] }[] {
  const groupes = new Map<string, EcheanceLocataire[]>()

  for (const echeance of echeances) {
    const annee = echeance.periode_debut.slice(0, 4)
    const liste = groupes.get(annee)
    if (liste) liste.push(echeance)
    else groupes.set(annee, [echeance])
  }

  return [...groupes.entries()]
    .map(([annee, mois]) => ({
      annee,
      mois: mois.sort((a, b) => b.periode_debut.localeCompare(a.periode_debut)),
    }))
    .sort((a, b) => b.annee.localeCompare(a.annee))
}

/**
 * Un bail résilié conserve-t-il des échéances à afficher ?
 *
 * Non : `v_echeances` ne calcule que les baux actifs. Un bail résilié apparaît
 * donc sans aucun mois, et l'écran doit le dire au lieu de laisser une liste
 * vide qui ressemble à une panne. C'est ce que cette fonction permet de
 * distinguer.
 */
export function sansEcheancesCalculees(bail: BailLocataire): boolean {
  return bail.statut !== 'Actif'
}
