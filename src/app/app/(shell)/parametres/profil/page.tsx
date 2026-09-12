import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { FormulairePhoto } from '@/components/app/formulaire-photo'
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

        {/*
          La photo avant l'avatar : c'est la représentation principale, et
          l'ordre de la page doit le dire. L'avatar reste juste en dessous —
          il n'est ni retiré, ni relégué en bas de page.
        */}
        <FormulairePhoto nom={bailleur.nom} aPhoto={Boolean(bailleur.photo_chemin)} />
        <FormulaireAvatar bailleur={bailleur} />
        <FormulaireMotDePasse email={bailleur.email} />
      </div>
    </div>
  )
}
