import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireMotDePasseOublie } from '@/components/auth/formulaires'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function PageMotDePasseOublie() {
  return (
    <CarteAuth
      titre="Mot de passe oublié"
      description="Indiquez votre adresse email : nous vous envoyons un lien pour en choisir un nouveau."
      bas={
        <Link href="/connexion" className="font-semibold text-ink underline">
          Retour à la connexion
        </Link>
      }
    >
      <FormulaireMotDePasseOublie />
    </CarteAuth>
  )
}
