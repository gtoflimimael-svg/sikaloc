'use server'

import { revalidatePath } from 'next/cache'

import { locataireCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * La seule écriture de Sikaloc_Me.
 *
 * ─── Ce qu'elle peut atteindre, et rien d'autre ─────────────────────────────
 *
 * Un booléen, sur les fiches du locataire connecté. Ni un paiement, ni un
 * loyer, ni un bail, ni une quittance : la fonction `definir_mes_notifications`
 * ne sait écrire que `notif_email`, et seulement là où
 * `prive.fiches_du_compte()` la conduit.
 *
 * ─── Aucun identifiant ne vient du formulaire ───────────────────────────────
 *
 * Le formulaire n'envoie que « oui » ou « non ». La fonction déduit de la
 * session à qui cela s'applique. Il n'y a donc rien à falsifier : pas de
 * `locataire_id` à deviner, pas de champ caché à retourner.
 */
export async function definirMesNotifications(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await locataireCourant()

  // La case cochée arrive comme 'on' ; absente, elle n'arrive pas du tout.
  const actif = donnees.get('notifEmail') !== null

  const supabase = await creerClientServeur()
  const { error } = await supabase.rpc('definir_mes_notifications', { p_actif: actif })

  if (error) {
    return { erreur: `Votre préférence n’a pas pu être enregistrée : ${error.message}` }
  }

  revalidatePath('/me/preferences')

  return {
    succes: actif
      ? 'Vous recevrez les emails de Sikaloc.'
      : 'Vous ne recevrez plus d’email de Sikaloc.',
  }
}
