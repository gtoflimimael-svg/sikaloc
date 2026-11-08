'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'

import { CaptureSignature } from '@/components/app/capture-signature'
import { Alerte } from '@/components/ui/retours'
import { televerserSignature } from '@/lib/actions/parametres'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/** Étape de navigation autonome, réutilisant la capture et l'action de profil. */
export function EtapeSignatureQuittance({
  actionReprise,
}: {
  actionReprise: () => Promise<EtatFormulaire | void>
}) {
  const [etatSignature, enregistrerSignature, signatureEnCours] = useActionState(
    televerserSignature,
    ETAT_INITIAL,
  )
  const [erreurReprise, setErreurReprise] = useState<string | null>(null)
  const [generationEnCours, demarrerGeneration] = useTransition()
  const dernierSuccesTraite = useRef<EtatFormulaire | null>(null)
  const verrouReprise = useRef(false)

  function reprendreGeneration() {
    if (verrouReprise.current || generationEnCours) return
    verrouReprise.current = true
    setErreurReprise(null)
    demarrerGeneration(async () => {
      try {
        const resultat = await actionReprise()
        if (resultat?.signatureRequise) {
          setErreurReprise(
            'La signature enregistrée n’a pas pu être vérifiée. Réessayez ou remplacez-la depuis les paramètres.',
          )
        } else if (resultat?.erreur) {
          setErreurReprise(resultat.erreur)
        } else if (resultat?.succes) {
          setErreurReprise(resultat.succes)
        } else {
          // Les actions normales redirigent vers le document en cas de succès.
          setErreurReprise('La génération n’a pas confirmé son résultat. Vous pouvez réessayer sans recréer le paiement.')
        }
      } finally {
        verrouReprise.current = false
      }
    })
  }

  useEffect(() => {
    if (
      !etatSignature.succes || signatureEnCours
      || dernierSuccesTraite.current === etatSignature
    ) return

    // Enregistre la réponse avant l'appel pour résister au double effet de
    // React Strict Mode sans lancer deux émissions concurrentes.
    dernierSuccesTraite.current = etatSignature
    reprendreGeneration()
    // L'action de reprise est déclenchée par la réponse persistée du formulaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etatSignature, signatureEnCours])

  return (
    <div className="space-y-md">
      {etatSignature.erreur ? (
        <div role="alert"><Alerte ton="erreur">{etatSignature.erreur}</Alerte></div>
      ) : null}
      {etatSignature.succes ? (
        <div role="status">
          <Alerte ton="succes">
            Signature enregistrée. {generationEnCours ? 'Reprise de la génération…' : 'La génération reprend.'}
          </Alerte>
        </div>
      ) : null}

      {!etatSignature.succes ? (
        <form action={enregistrerSignature} className="space-y-md">
          <CaptureSignature
            libelleEnregistrement="Enregistrer et continuer"
            restaurerApresEchec={etatSignature.erreur ? etatSignature : null}
            compact
          />
        </form>
      ) : null}

      {erreurReprise ? (
        <div className="space-y-md">
          <div role="alert"><Alerte ton="erreur">{erreurReprise}</Alerte></div>
          <button
            type="button"
            onClick={reprendreGeneration}
            disabled={generationEnCours}
            aria-busy={generationEnCours}
            className="btn btn-primary"
          >
            {generationEnCours ? 'Génération…' : 'Réessayer la génération'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
