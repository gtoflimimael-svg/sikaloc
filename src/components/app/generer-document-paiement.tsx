'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { Alerte } from '@/components/ui/retours'
import { useVerrouGroupeActions } from '@/components/ui/action-confirmee'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Lance la génération. Si le serveur confirme qu'une quittance exige une
 * signature, la même opération reprend sur une route dédiée, sans modal.
 */
export function GenererDocumentPaiement({
  action,
  signatureHref,
  libelle,
  libelleEnCours = 'Génération…',
}: {
  action: () => Promise<EtatFormulaire | void>
  /** Route interne contenant uniquement l'identifiant du paiement et l'action. */
  signatureHref: string
  libelle: string
  libelleEnCours?: string
}) {
  const routeur = useRouter()
  const groupe = useVerrouGroupeActions()
  const [erreur, setErreur] = useState<string | null>(null)
  const [generationEnCours, demarrerGeneration] = useTransition()
  const verrouLocal = useRef(false)

  function liberer() {
    if (!verrouLocal.current) return
    verrouLocal.current = false
    groupe?.liberer()
  }

  function reserver(): boolean {
    if (verrouLocal.current || (groupe && !groupe.reserver())) return false
    verrouLocal.current = true
    return true
  }

  function lancer() {
    if (generationEnCours || !reserver()) return
    setErreur(null)
    demarrerGeneration(async () => {
      try {
        const resultat = await action()
        if (resultat?.signatureRequise) {
          // Le serveur a refusé avant toute validation/émission. La route
          // recharge le paiement depuis la base; aucun montant n'est en URL.
          liberer()
          routeur.push(signatureHref)
          return
        }
        if (resultat?.erreur) setErreur(resultat.erreur)
        else if (resultat?.succes) setErreur(null)
      } finally {
        liberer()
      }
    })
  }

  return (
    <div className="space-y-md">
      {erreur ? <div role="alert"><Alerte ton="erreur">{erreur}</Alerte></div> : null}
      <button
        type="button"
        onClick={lancer}
        disabled={generationEnCours || Boolean(groupe?.occupe)}
        aria-busy={generationEnCours}
        className="btn btn-primary"
      >
        {generationEnCours ? libelleEnCours : libelle}
      </button>
    </div>
  )
}
