'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { echeancesADeclarer, MESSAGES_HISTORIQUE } from '@/lib/echeances'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Echeance } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'
import { ESPACE_PRO } from '@/lib/roles'

/**
 * Déclaration des loyers réglés avant l'usage de Sikaloc.
 *
 * ─── Ce que le navigateur envoie, et ce qu'on en fait ───────────────────────
 *
 * Il envoie une liste de mois cochés. On ne la croit sur rien.
 *
 * La liste des mois légitimement déclarables est relue ici, depuis
 * `v_echeances` — la vue qui décide, protégée par RLS. Tout mois envoyé qui
 * n'y figure pas est refusé : mois d'un autre bail, mois hors période, mois à
 * venir, mois déjà réglé. Le cahier des charges le demande explicitement, et
 * il a raison : ce formulaire écrit des faits financiers.
 *
 * ─── Ce qui est écrit ───────────────────────────────────────────────────────
 *
 *   coché    → un paiement `historique = true`, `date_paiement = null`
 *   décoché  → rien
 *
 * Rien, pour un mois décoché, n'est pas un oubli : c'est déjà l'état par
 * défaut. Ce qui le fait basculer en « Impayé », c'est la marque posée sur le
 * bail à la fin — `historique_declare_le`. Avant elle, l'absence de paiement
 * signifiait « on ne sait pas » ; après, elle signifie « le bailleur a dit non ».
 *
 * ─── Aucune quittance ───────────────────────────────────────────────────────
 *
 * Les paiements créés ici ne passent pas par `validerPaiement`, et c'est
 * délibéré : cette fonction émet une quittance datée du jour. Produire une
 * quittance de janvier portant la date d'aujourd'hui serait fabriquer une pièce
 * qui n'a jamais existé.
 */

function periodesSoumises(donnees: FormData): string[] {
  return donnees
    .getAll('mois')
    .map((v) => String(v))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
}

export async function declarerHistorique(
  bailId: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur

  const supabase = await creerClientServeur()

  // Le bail, et la confirmation qu'il appartient bien à ce bailleur. La RLS le
  // garantit déjà ; on veut surtout distinguer « pas à vous » de « inexistant »
  // sans le dire à l'appelant.
  const { data: bail } = await supabase
    .from('baux')
    .select('id, historique_declare_le')
    .eq('id', bailId)
    .maybeSingle()

  if (!bail) return { erreur: MESSAGES_HISTORIQUE.bail_introuvable }

  // ── La liste qui fait autorité ───────────────────────────────────────────
  const { data: lignes } = await supabase
    .from('v_echeances')
    .select('*')
    .eq('bail_id', bailId)
    .eq('bailleur_id', bailleur.id)

  const echeances = (lignes ?? []) as Echeance[]
  const declarables = echeancesADeclarer(echeances)

  if (declarables.length === 0) {
    return { erreur: MESSAGES_HISTORIQUE.rien_a_declarer }
  }

  const soumises = periodesSoumises(donnees)

  // Doublons : deux fois le même mois fabriquerait deux paiements pour un seul
  // loyer, et solderait une période qui ne l'est pas.
  if (new Set(soumises).size !== soumises.length) {
    return { erreur: MESSAGES_HISTORIQUE.doublon }
  }

  const parPeriode = new Map(declarables.map((e) => [e.periode_debut, e]))
  const retenues: Echeance[] = []

  for (const periode of soumises) {
    const echeance = parPeriode.get(periode)

    // Un mois absent de la liste autorisée est refusé sans chercher à deviner
    // pourquoi : il n'appartient pas au bail, il est à venir, ou il est déjà
    // réglé. Les trois cas se traitent pareil — on n'écrit pas.
    if (!echeance) {
      const connue = echeances.find((e) => e.periode_debut === periode)
      if (!connue) return { erreur: MESSAGES_HISTORIQUE.periode_inconnue }
      if (connue.etat === 'À venir') return { erreur: MESSAGES_HISTORIQUE.periode_future }
      if (connue.etat === 'Réglé') return { erreur: MESSAGES_HISTORIQUE.deja_regle }
      return { erreur: MESSAGES_HISTORIQUE.periode_inconnue }
    }

    retenues.push(echeance)
  }

  // Validation et écriture sont répétées et atomisées en base. Le formulaire
  // sert à guider l'utilisateur; la RPC reste l'autorité contre les requêtes
  // rejouées, les doublons et les changements concurrents d'échéance.
  const { data: nombreInsere, error } = await supabase.rpc('declarer_paiements_historiques', {
    p_bail_id: bailId,
    p_periodes: retenues.map((e) => e.periode_debut),
  })

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }
  if (nombreInsere === null) return { erreur: 'Enregistrement impossible. Réessayez.' }

  revalidatePath('/pro/impayes')
  revalidatePath('/pro/paiements')
  revalidatePath(`/pro/baux/${bailId}`)
  revalidatePath(ESPACE_PRO.tableauDeBord)

  redirect(`/pro/baux/${bailId}`)
}
