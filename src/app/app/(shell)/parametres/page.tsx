import { ChevronRight, CreditCard, Gift, PenLine, SlidersHorizontal, UserRound } from 'lucide-react'
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
    redirect(`/app/parametres/${onglet}${retour ? `?retour=${retour}` : ''}`)
  }

  return (
    <div>
      <EnTetePage
        titre="Paramètres"
        description="Votre profil, votre signature, vos préférences et votre abonnement."
      />

      <div className="grid gap-lg sm:grid-cols-2">
        {SECTIONS_PARAMETRES.map((section, index) => {
          const Icone = ICONES[section.cle]

          return (
            <Link
              key={section.cle}
              href={`/app/parametres/${section.cle}`}
              style={{ '--delai': `${index * 45}ms` } as React.CSSProperties}
              className="card card-lg anim-monte group flex flex-col gap-md transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-surface-elevated hover:shadow-elevated focus-visible:-translate-y-0.5"
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary-pale text-ink-deep transition-transform duration-200 group-hover:scale-105">
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
