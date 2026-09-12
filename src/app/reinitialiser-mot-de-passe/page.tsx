import type { Metadata } from 'next'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireNouveauMotDePasse } from '@/components/auth/formulaires'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

/**
 * Atterrissage du lien de réinitialisation.
 *
 * `/auth/callback` a déjà échangé le code contre une session : l'utilisateur
 * est authentifié le temps de choisir son nouveau mot de passe.
 *
 * L'email est lu ici et non dans le formulaire, qui est un composant client :
 * il alimente le champ d'identifiant caché qui permet au gestionnaire de mots
 * de passe de rattacher le nouveau mot de passe au bon compte. Absent, le
 * formulaire fonctionne à l'identique — c'est une aide, pas une dépendance.
 */
export default async function PageReinitialisation() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <CarteAuth
      titre="Choisir un nouveau mot de passe"
      description="Il remplacera immédiatement l'ancien."
    >
      <FormulaireNouveauMotDePasse email={utilisateur?.email} />
    </CarteAuth>
  )
}
