import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { bailleurCourant } from '@/lib/session'
import { ESPACE_PRO } from '@/lib/roles'

export const metadata: Metadata = { title: 'Bienvenue' }

/** Ancienne URL conservée pour les favoris : aucun onboarding n'est requis. */
export default async function PageOnboarding() {
  await bailleurCourant()
  redirect(ESPACE_PRO.tableauDeBord)
}
