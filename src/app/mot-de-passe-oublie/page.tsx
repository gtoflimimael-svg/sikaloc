import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireMotDePasseOublie } from '@/components/auth/formulaires'
import {
  contexteDepuisSuite,
  destinationParDefautConnexion,
  lienConnexion,
  normaliserContexteConnexion,
  normaliserSuiteConnexion,
  suitePourContexteConnexion,
} from '@/lib/auth-contexte'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default async function PageMotDePasseOublie({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; context?: string }>
}) {
  const { suite: suiteBrute, context: contexteBrut } = await searchParams
  const suiteValidee = normaliserSuiteConnexion(suiteBrute)
  const contexte =
    contexteDepuisSuite(suiteValidee) ??
    normaliserContexteConnexion(contexteBrut) ??
    'general'
  const suite = suitePourContexteConnexion(
    suiteValidee ?? destinationParDefautConnexion(contexte),
    contexte,
  )

  return (
    <CarteAuth
      titre="Mot de passe oublié"
      description="Indiquez votre adresse email : nous vous envoyons un lien pour en choisir un nouveau."
      bas={
        <Link href={lienConnexion(contexte, suite)} className="font-semibold text-ink underline">
          Retour à la connexion
        </Link>
      }
    >
      <FormulaireMotDePasseOublie contexte={contexte} suite={suite} />
    </CarteAuth>
  )
}
