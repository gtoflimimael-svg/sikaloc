import type { Metadata } from 'next'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireNouveauMotDePasse } from '@/components/auth/formulaires'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

/**
 * Atterrissage du lien de réinitialisation.
 *
 * `/auth/callback` a déjà échangé le code contre une session : l'utilisateur
 * est authentifié le temps de choisir son nouveau mot de passe.
 */
export default function PageReinitialisation() {
  return (
    <CarteAuth
      titre="Choisir un nouveau mot de passe"
      description="Il remplacera immédiatement l'ancien."
    >
      <FormulaireNouveauMotDePasse />
    </CarteAuth>
  )
}
