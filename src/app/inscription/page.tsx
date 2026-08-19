import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireInscription } from '@/components/auth/formulaires'

export const metadata: Metadata = { title: 'Créer un compte' }

export default async function PageInscription({
  searchParams,
}: {
  searchParams: Promise<{ parrain?: string }>
}) {
  const { parrain } = await searchParams

  return (
    <CarteAuth
      titre="Créer votre compte"
      description="Deux minutes pour votre première quittance conforme."
      bas={
        <>
          Vous avez déjà un compte ?{' '}
          <Link href="/connexion" className="font-semibold text-ink underline">
            Se connecter
          </Link>
        </>
      }
    >
      <FormulaireInscription codeParrain={parrain?.toUpperCase()} />
    </CarteAuth>
  )
}
