'use client'

import { Send } from 'lucide-react'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { inviterLocataire } from '@/lib/actions/invitations'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Inviter un locataire sur Sikaloc_Me.
 *
 * ─── Un seul libellé d’action, fourni par la page ───────────────────────────
 *
 * Le composant ne décide plus de l'état de l'accès : la page liste présente
 * séparément le statut Me, et ne rend ce bouton que lorsque l'envoi est permis
 * par les informations actuellement disponibles.
 */
export function BoutonInvitation({
  locataireId,
  libelle,
}: {
  locataireId: string
  libelle: 'Inviter' | 'Renvoyer'
}) {
  const action = inviterLocataire.bind(null, locataireId)
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  return (
    <div className="min-w-0">
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}
      {etat.erreur ? <Alerte ton="attention">{etat.erreur}</Alerte> : null}

      {!etat.succes ? (
        <form action={envoyer}>
          <BoutonSoumettre variante="tertiary" compact libelleEnCours="Envoi…">
            <Send size={15} strokeWidth={2} aria-hidden="true" />
            {libelle}
          </BoutonSoumettre>
        </form>
      ) : null}
    </div>
  )
}
