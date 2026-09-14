import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { FormulairePreferences } from '@/components/app/parametres'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Préférences' }

export default async function PagePreferences() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="preferences" />
      <FormulairePreferences bailleur={bailleur} />
    </div>
  )
}
