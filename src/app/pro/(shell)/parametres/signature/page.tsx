import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { FormulaireSignature } from '@/components/app/parametres'
import { Alerte } from '@/components/ui/retours'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Signature' }

export default async function PageSignature() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="signature" />

      <div className="space-y-lg">
        <div className="card-sage">
          <p className="text-body-md font-semibold text-ink-deep">
            Pourquoi une signature ?
          </p>
          <p className="mt-sm text-body-md text-body">
            L&apos;image enregistrée est apposée visuellement sur les quittances
            PDF. Sikaloc ne certifie pas l&apos;identité du signataire et ne
            fournit pas de signature électronique qualifiée. Vérifiez les
            exigences applicables à votre situation avant de vous appuyer sur
            un document signé.
          </p>
        </div>

        {bailleur.signature_chemin ? (
          <Alerte ton="succes">
            Une signature est enregistrée. Elle apparaît sur vos quittances.
          </Alerte>
        ) : (
          <Alerte ton="attention">
            Aucune signature enregistrée : vos quittances sortent avec un cadre de
            signature vide.
          </Alerte>
        )}

        <FormulaireSignature signatureExistante={Boolean(bailleur.signature_chemin)} />
      </div>
    </div>
  )
}
