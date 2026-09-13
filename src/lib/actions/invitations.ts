'use server'

import { revalidatePath } from 'next/cache'

import { envoyerEmail } from '@/lib/emails'
import {
  creerJeton,
  DELAI_RENVOI_SECONDES,
  empreinteJeton,
  expiration,
  lienInvitation,
  MESSAGES_ENVOI,
  MESSAGES_INVITATION,
  secretPresent,
  VALIDITE_JOURS,
  type MotifInvitation,
} from '@/lib/invitations'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * L'invitation d'un locataire à Sikaloc_Me.
 *
 * ─── Le seul chemin vers un compte locataire ────────────────────────────────
 *
 * C'est le bailleur qui désigne, parce que lui seul sait de quel bail il
 * s'agit. Sans ce geste, un compte locataire ne serait relié à rien — et le
 * rattacher après coup reviendrait à deviner, avec le risque de donner à
 * quelqu'un les quittances de son voisin.
 *
 * ─── Email uniquement ───────────────────────────────────────────────────────
 *
 * WhatsApp serait plus naturel pour un locataire béninois, et ce sera le cas
 * le jour où un fournisseur existe. En attendant, l'email part réellement — ce
 * qui vaut mieux qu'un canal qui ferait semblant.
 */

// ═══ Côté Sikaloc_Pro — envoyer ══════════════════════════════════════════════

export async function inviterLocataire(
  locataireId: string,
  _etat: EtatFormulaire,
  _donnees: FormData,
): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur

  if (!secretPresent()) return { erreur: MESSAGES_ENVOI.secret_absent }

  const supabase = await creerClientServeur()

  // La RLS garantit déjà que ce locataire est le sien ; la requête ne rend
  // rien dans le cas contraire.
  const { data: locataire } = await supabase
    .from('locataires')
    .select('id, nom, email, compte_id, bail:baux(logement:logements(adresse, ville))')
    .eq('id', locataireId)
    .maybeSingle()

  if (!locataire) return { erreur: 'Ce locataire est introuvable.' }
  if (locataire.compte_id) return { erreur: MESSAGES_ENVOI.deja_rattache }

  const email = (locataire.email ?? '').trim().toLowerCase()
  if (!email) return { erreur: MESSAGES_ENVOI.sans_email }

  // ── Anti-abus ────────────────────────────────────────────────────────────
  //
  // Sans délai, le bouton « inviter » devient un moyen de faire arriver
  // autant d'emails qu'on veut dans la boîte de quelqu'un.
  const { data: derniere } = await supabase
    .from('invitations_locataire')
    .select('cree_le')
    .eq('locataire_id', locataireId)
    .order('cree_le', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (derniere) {
    const ecoule = (Date.now() - new Date(derniere.cree_le).getTime()) / 1000
    if (ecoule < DELAI_RENVOI_SECONDES) return { erreur: MESSAGES_ENVOI.trop_tot }
  }

  // ── Un nouveau jeton annule les précédents ───────────────────────────────
  //
  // Avant l'insertion : deux invitations valables en même temps pour le même
  // locataire, c'est un lien de trop qui traîne.
  await supabase
    .from('invitations_locataire')
    .update({ annulee_le: new Date().toISOString() })
    .eq('locataire_id', locataireId)
    .is('utilisee_le', null)
    .is('annulee_le', null)

  const { jeton, empreinte } = creerJeton()

  const { error } = await supabase.from('invitations_locataire').insert({
    locataire_id: locataireId,
    bailleur_id: bailleur.id,
    email,
    empreinte,
    expire_le: expiration(),
    cree_par: bailleur.id,
  })

  if (error) return { erreur: `Invitation impossible : ${error.message}` }

  const logement = premierLogement(locataire)

  const envoi = await envoyerEmail(
    email,
    'invitation_locataire',
    {
      nom: locataire.nom,
      bailleur_nom: bailleur.nom,
      logement,
      lien: lienInvitation(jeton),
      validite_jours: VALIDITE_JOURS,
    },
    // Clé d'idempotence : un double-clic ne fait pas partir deux emails.
    `invitation-${empreinte.slice(0, 32)}`,
  )

  if (!envoi.ok) {
    // Le jeton n'est jamais parti : le laisser valable ne servirait qu'à
    // encombrer, et à faire croire qu'une invitation est en attente.
    await supabase
      .from('invitations_locataire')
      .update({ annulee_le: new Date().toISOString() })
      .eq('empreinte', empreinte)

    return { erreur: MESSAGES_ENVOI.envoi_echoue }
  }

  revalidatePath('/app/locataires')
  revalidatePath(`/app/locataires/${locataireId}/modifier`)

  return { succes: `Invitation envoyée à ${email}.` }
}

/** Le logement du premier bail, pour situer l'invitation dans l'email. */
function premierLogement(locataire: {
  bail?: unknown
}): string {
  const baux = Array.isArray(locataire.bail) ? locataire.bail : [locataire.bail]
  for (const bail of baux) {
    const logement = (bail as { logement?: { adresse?: string; ville?: string } } | null)
      ?.logement
    const cible = Array.isArray(logement) ? logement[0] : logement
    if (cible?.adresse) {
      return cible.ville ? `${cible.adresse}, ${cible.ville}` : cible.adresse
    }
  }
  return ''
}

/** Révoque l'invitation en attente, sans en envoyer de nouvelle. */
export async function annulerInvitation(
  locataireId: string,
): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const supabase = await creerClientServeur()
  const { error } = await supabase
    .from('invitations_locataire')
    .update({ annulee_le: new Date().toISOString() })
    .eq('locataire_id', locataireId)
    .is('utilisee_le', null)
    .is('annulee_le', null)

  if (error) return { erreur: `Annulation impossible : ${error.message}` }

  revalidatePath('/app/locataires')
  return { succes: 'Invitation annulée.' }
}

// ═══ Côté Sikaloc_Me — accepter ══════════════════════════════════════════════

export interface ResultatAcceptation {
  ok: boolean
  motif: MotifInvitation
  message: string
}

/**
 * Consomme une invitation pour le compte connecté.
 *
 * ─── Ce que le navigateur envoie ────────────────────────────────────────────
 *
 * Un jeton, et rien d'autre. Tout le reste — de quel locataire il s'agit, de
 * quel bail, si l'invitation est encore valable, si la ligne est déjà prise —
 * est décidé en base par `accepter_invitation`, en une seule opération.
 *
 * Trois écritures doivent réussir ou échouer ensemble : consommer le jeton,
 * rattacher le compte, horodater. Les séparer laisserait soit un jeton
 * réutilisable, soit un locataire dehors avec un lien devenu inutile.
 */
export async function accepterInvitation(jeton: string): Promise<ResultatAcceptation> {
  if (!secretPresent()) {
    return {
      ok: false,
      motif: 'introuvable',
      message: MESSAGES_INVITATION.introuvable,
    }
  }

  const supabase = await creerClientServeur()

  const { data, error } = await supabase.rpc('accepter_invitation', {
    p_empreinte: empreinteJeton(jeton),
  })

  if (error || !data) {
    return { ok: false, motif: 'introuvable', message: MESSAGES_INVITATION.introuvable }
  }

  const ligne = Array.isArray(data) ? data[0] : data
  const motif = (ligne?.motif ?? 'introuvable') as MotifInvitation

  if (motif !== 'ok') {
    return { ok: false, motif, message: MESSAGES_INVITATION[motif] }
  }

  revalidatePath('/', 'layout')
  return { ok: true, motif: 'ok', message: MESSAGES_INVITATION.ok }
}
