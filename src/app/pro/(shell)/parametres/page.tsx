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

      <div className="settings-section-list grid gap-lg sm:grid-cols-2">
        {SECTIONS_PARAMETRES.map((section, index) => {
          const Icone = ICONES[section.cle]

          return (
            <Link
              key={section.cle}
              href={`/pro/parametres/${section.cle}`}
              style={{ '--delai': `${index * 45}ms` } as React.CSSProperties}
              className="settings-link-card anim-monte group flex flex-col gap-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span className="settings-link-icon flex items-center justify-center bg-primary-pale text-ink-deep transition-colors duration-200 group-hover:bg-primary">
                <Icone size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>

              <span className="flex items-center justify-between gap-sm">
                <span className="text-title-lg font-semibold text-ink">
                  {section.titre}
                </span>
                <ChevronRight
                  size={18}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </span>

              <span className="text-body-sm text-mute">{section.details}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
