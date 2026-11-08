import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { FormulaireSignature } from '@/components/app/parametres'
import { Alerte } from '@/components/ui/retours'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Signature' }

export default async function PageSignature() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="settings-signature-page max-w-[46rem]">
      <EnteteParametre cle="signature" />

      <div className="space-y-lg">
        <div className="signature-explainer card-sage">
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
            Une signature est requise pour générer une nouvelle quittance de loyer.
            Vous pouvez l&apos;enregistrer maintenant ou plus tard depuis cette page.
          </Alerte>
        )}

        <FormulaireSignature signatureExistante={Boolean(bailleur.signature_chemin)} />
      </div>
    </div>
  )
}
