import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import {
  FormulaireAvatar,
  FormulaireMotDePasse,
  FormulaireProfil,
} from '@/components/app/parametres'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Profil' }

export default async function PageProfil() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="profil" />

      <div className="space-y-xl">
        {/* Les informations d'abord, l'avatar ensuite : le même ordre qu'à
            l'inscription, pour que la page ne s'ouvre pas sur un jeu. */}
        <FormulaireProfil bailleur={bailleur} />
        <FormulaireAvatar bailleur={bailleur} />
        <FormulaireMotDePasse />
      </div>
    </div>
  )
}
