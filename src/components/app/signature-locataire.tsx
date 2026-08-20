'use client'

import { useActionState } from 'react'

import { CaptureSignature } from '@/components/app/capture-signature'
import { BoutonAction } from '@/components/ui/action-confirmee'
import { Alerte } from '@/components/ui/retours'
import { supprimerSignatureLocataire, televerserSignatureLocataire } from '@/lib/actions/locataires'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Signature du locataire — recueillie par le bailleur, en personne.
 *
 * Le locataire n'a pas de compte Sikaloc (spec §9.2) : il ne peut pas la
 * téléverser depuis chez lui. Ce bloc vit donc sur la fiche du locataire, pas
 * dans un espace qui lui serait propre, et le bailleur le remplit au moment où
 * le locataire est physiquement présent — typiquement à la signature du bail.
 */
export function SignatureLocataire({
  locataireId,
  signatureExistante,
}: {
  locataireId: string
  signatureExistante: boolean
}) {
  const action = televerserSignatureLocataire.bind(null, locataireId)
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)
  const supprimer = supprimerSignatureLocataire.bind(null, locataireId)

  return (
    <div className="card card-lg space-y-lg">
      <div>
        <h2 className="text-title-lg font-semibold text-ink">Signature du locataire</h2>
        <p className="mt-xxs text-body-sm text-mute">
          Elle apparaît à côté de la vôtre sur chaque quittance : la quittance
          vaut décharge, et le locataire y reconnaît avoir versé la somme.
        </p>
      </div>

      {signatureExistante ? (
        <Alerte ton="succes">
          Une signature est enregistrée pour ce locataire.
        </Alerte>
      ) : (
        <Alerte ton="info">
          Aucune signature enregistrée : les quittances de ce locataire sortent
          avec un cadre de signature vide à sa place.
        </Alerte>
      )}

      <form action={envoyer} className="space-y-lg">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

        <CaptureSignature />
      </form>

      {signatureExistante ? (
        <BoutonAction
          action={supprimer}
          libelle="Supprimer cette signature"
          libelleEnCours="Suppression…"
          variante="secondary"
          compact
        />
      ) : null}
    </div>
  )
}
