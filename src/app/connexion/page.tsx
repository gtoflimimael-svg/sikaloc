import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireConnexion } from '@/components/auth/formulaires'
import { Alerte } from '@/components/ui/retours'

export const metadata: Metadata = { title: 'Connexion' }

const MESSAGES_ERREUR: Record<string, string> = {
  lien_invalide: 'Ce lien est invalide. Demandez-en un nouveau.',
  lien_expire: 'Ce lien a expiré. Demandez une nouvelle réinitialisation.',
}

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>
}) {
  const { suite, erreur } = await searchParams

  return (
    <CarteAuth
      titre="Bon retour"
      description="Connectez-vous pour retrouver vos baux et vos quittances."
      bas={
        <>
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="font-semibold text-ink underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {erreur && MESSAGES_ERREUR[erreur] ? (
        <div className="mb-lg">
          <Alerte ton="attention">{MESSAGES_ERREUR[erreur]}</Alerte>
        </div>
      ) : null}

      <FormulaireConnexion suite={suite} />
    </CarteAuth>
  )
}
