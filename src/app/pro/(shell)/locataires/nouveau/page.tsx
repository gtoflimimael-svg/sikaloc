import type { Metadata } from 'next'

import { FormulaireLocataire } from '@/components/app/formulaire-locataire'
import { EnTetePage } from '@/components/ui/retours'
import { creerLocataire } from '@/lib/actions/locataires'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Nouveau locataire' }

export default async function PageNouveauLocataire() {
  await bailleurOnboarde()

  return (
    <div className="tenant-form-page mx-auto max-w-[42rem]">
      <EnTetePage
        titre="Nouveau locataire"
        description="Ces coordonnées servent à rattacher le locataire à ses baux et à préparer les moyens de partage disponibles."
      />
      <FormulaireLocataire action={creerLocataire} />
    </div>
  )
}
