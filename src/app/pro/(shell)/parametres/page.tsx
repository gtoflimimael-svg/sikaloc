import {
  ChevronRight,
  CreditCard,
  DatabaseBackup,
  Gift,
  PenLine,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { EnTetePage } from '@/components/ui/retours'
import {
  estCleParametre,
  SECTIONS_PARAMETRES,
  type CleParametre,
} from '@/lib/parametres'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres' }

const ICONES: Record<CleParametre, typeof UserRound> = {
  profil: UserRound,
  signature: PenLine,
  preferences: SlidersHorizontal,
  parrainage: Gift,
  abonnement: CreditCard,
  donnees: DatabaseBackup,
}

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; retour?: string }>
}) {
  await bailleurOnboarde()
  const { onglet, retour } = await searchParams

  // Les emails déjà partis et les liens en circulation pointent encore sur
  // `?onglet=abonnement`. On les fait atterrir sur la bonne route plutôt que
  // sur un index qui perdrait le retour de guichet FedaPay.
  if (estCleParametre(onglet)) {
    redirect(`/pro/parametres/${onglet}${retour ? `?retour=${retour}` : ''}`)
  }

  return (
    <div className="settings-index-page">
      <EnTetePage
        titre="Paramètres"
        description="Votre profil, votre signature, vos préférences et votre abonnement."
      />

      <div className="settings-section-list">
        {SECTIONS_PARAMETRES.map((section) => {
          const Icone = ICONES[section.cle]

          return (
            <Link
              key={section.cle}
              href={`/pro/parametres/${section.cle}`}
              className="settings-link-card group"
            >
              <span className="settings-link-icon" aria-hidden="true">
                <Icone size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>

              <span className="settings-link-copy">
                <span className="settings-link-title">
                  {section.titre}
                </span>
                <span className="settings-link-description">{section.details}</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className="settings-link-arrow" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
