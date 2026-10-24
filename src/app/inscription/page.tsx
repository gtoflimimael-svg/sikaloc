import type { Metadata } from 'next'
import Link from 'next/link'

import { ExperienceInscription } from '@/components/auth/experience-inscription'
import { FormulaireInscription } from '@/components/auth/formulaires'
import { lienConnexion } from '@/lib/auth-contexte'

export const metadata: Metadata = { title: 'Créer un compte' }

export default async function PageInscription({
  searchParams,
}: {
  searchParams: Promise<{ parrain?: string }>
}) {
  const { parrain } = await searchParams

  return (
    <ExperienceInscription
      espace="Pro"
      label="Sikaloc Pro · Gestion locative"
      titreEditorial="Votre gestion locative commence simplement."
      descriptionEditorial="Un espace clair pour organiser vos logements, suivre les paiements enregistrés et retrouver vos documents."
      image="/images/pro/sikaloc-pro-inscription-property-review.webp"
      imageAlt="Image illustrative : une propriétaire ouest-africaine évalue la lumière naturelle d’un logement qu’elle prépare à louer."
      titreFormulaire="Créer votre compte bailleur"
      descriptionFormulaire="Quelques informations suffisent pour ouvrir votre espace Sikaloc Pro."
      afficherAccueilBas={false}
      bas={
        <>
          <p>
            Vous avez déjà un compte ?{' '}
            <Link href={lienConnexion('pro', '/pro/tableau-de-bord')}>Se connecter</Link>
          </p>
        </>
      }
    >
      <FormulaireInscription codeParrain={parrain?.toUpperCase()} />
    </ExperienceInscription>
  )
}
