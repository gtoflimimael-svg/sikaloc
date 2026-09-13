'use client'

import { Check, Send } from 'lucide-react'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { inviterLocataire } from '@/lib/actions/invitations'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Inviter un locataire sur Sikaloc_Me.
 *
 * ─── Quatre états, et un seul bouton ────────────────────────────────────────
 *
 *   rattaché        l'accès existe déjà — rien à proposer
 *   sans email      le bouton serait un piège : on dit ce qui manque
 *   invitation déjà partie  on propose le renvoi, pas l'envoi
 *   sinon           « Inviter »
 *
 * Le deuxième cas mérite l'attention : proposer un bouton qui échouera toujours
 * est plus décourageant que de ne rien proposer du tout. On nomme la cause et
 * on donne le chemin.
 */
export function BoutonInvitation({
  locataireId,
  nom,
  email,
  rattache,
  invitationEnAttente,
}: {
  locataireId: string
  nom: string
  email: string | null
  /** Le locataire a déjà un compte rattaché. */
  rattache: boolean
  /** Une invitation est partie et n'a pas encore été utilisée. */
  invitationEnAttente: boolean
}) {
  const action = inviterLocataire.bind(null, locataireId)
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  if (rattache) {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm text-positive-deep">
        <Check size={15} strokeWidth={2.5} aria-hidden="true" />
        Accès Sikaloc_Me actif
      </span>
    )
  }

  if (!email) {
    return (
      <span className="text-body-sm text-mute">
        Ajoutez une adresse email pour inviter {nom.split(' ')[0]}
      </span>
    )
  }

  return (
    <div className="min-w-0">
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}
      {etat.erreur ? <Alerte ton="attention">{etat.erreur}</Alerte> : null}

      {!etat.succes ? (
        <form action={envoyer}>
          <BoutonSoumettre variante="tertiary" compact libelleEnCours="Envoi…">
            <Send size={15} strokeWidth={2} aria-hidden="true" />
            {invitationEnAttente ? 'Renvoyer l’invitation' : 'Inviter sur Sikaloc_Me'}
          </BoutonSoumettre>
        </form>
      ) : null}
    </div>
  )
}
