'use server'

import { revalidatePath } from 'next/cache'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Les trois sorties de la visite guidée.
 *
 * Écritures faites avec le client porteur de la session — donc soumises à la
 * RLS — et non avec `service_role` : un bailleur n'écrit que sa propre ligne.
 *
 * Toutes revalident `/app` en layout, parce que la visite est montée dans le
 * shell et non dans une page : sans cela, l'état resterait celui du rendu
 * précédent jusqu'à la prochaine navigation complète.
 */

/**
 * La visite a été menée à son terme.
 *
 * Idempotente : la date conservée est celle de la PREMIÈRE fin, jamais écrasée
 * par un rejeu. Efface `visite_quittee_le` — avoir abandonné puis terminé, c'est
 * avoir terminé.
 */
export async function terminerVisite(): Promise<void> {
  const bailleur = await bailleurCourant()
  if (bailleur.tutoriel_vu_le) return

  const supabase = await creerClientServeur()
  await supabase
    .from('bailleurs')
    .update({ tutoriel_vu_le: new Date().toISOString(), visite_quittee_le: null })
    .eq('id', bailleur.id)

  revalidatePath('/app', 'layout')
}

/**
 * Le bailleur sort avant la fin.
 *
 * On note la date plutôt que de ne rien faire : sans elle, « quittée » serait
 * indiscernable de « jamais commencée » et la visite se rouvrirait à chaque
 * arrivée sur l'application. Elle reste reprenable depuis le tableau de bord.
 */
export async function quitterVisite(): Promise<void> {
  const bailleur = await bailleurCourant()

  const supabase = await creerClientServeur()
  await supabase
    .from('bailleurs')
    .update({ visite_quittee_le: new Date().toISOString() })
    .eq('id', bailleur.id)

  revalidatePath('/app', 'layout')
}

/**
 * Reprise explicite, depuis le tableau de bord.
 *
 * Efface les deux dates : on repart d'une visite ouverte, à l'étape que les
 * données du bailleur désignent — pas forcément la première.
 */
export async function reprendreVisite(): Promise<void> {
  const bailleur = await bailleurCourant()

  const supabase = await creerClientServeur()
  await supabase
    .from('bailleurs')
    .update({ tutoriel_vu_le: null, visite_quittee_le: null })
    .eq('id', bailleur.id)

  revalidatePath('/app', 'layout')
}
