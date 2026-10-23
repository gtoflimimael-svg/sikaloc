import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import {
  FormulaireMotDePasse,
  FormulaireProfil,
} from '@/components/app/parametres'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Profil' }

export default async function PageProfil() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="settings-profile-page max-w-[46rem]">
      <EnteteParametre cle="profil" />

      <div className="space-y-xl">
        <FormulaireProfil bailleur={bailleur} />
        <FormulaireMotDePasse email={bailleur.email} />
      </div>
    </div>
  )
}
