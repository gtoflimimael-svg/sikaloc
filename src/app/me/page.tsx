import { redirect } from 'next/navigation'

import { ESPACE_PRO } from '@/lib/roles'
import { rolesDuCompte } from '@/lib/session'

/**
 * La racine de Sikaloc_Me.
 *
 * ─── Ce qu'elle fait aujourd'hui ────────────────────────────────────────────
 *
 * Elle aiguille, et rien d'autre. Le tableau de bord du locataire — logement,
 * bail, loyers, paiements, quittances — arrive à l'étape suivante ; il a besoin
 * du parcours d'invitation, qui est ce qui rattache un compte à un bail.
 *
 * En attendant, aucun compte n'est rattaché à un locataire : tout le monde
 * atterrit donc sur l'explication, qui est la réponse juste. Poser ici un
 * tableau de bord vide aurait laissé croire que l'espace existe et qu'il est
 * cassé.
 */
export default async function PageMe() {
  const roles = await rolesDuCompte()

  // Un bailleur qui atterrit ici par curiosité ou par un vieux lien : on le
  // renvoie chez lui plutôt que de lui expliquer un espace qui n'est pas le
  // sien.
  if (roles.estBailleur && !roles.estLocataire) redirect(ESPACE_PRO.racine)

  redirect('/me/rejoindre')
}
