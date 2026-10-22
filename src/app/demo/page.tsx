import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { EnvironnementDemo } from '@/components/demo/environnement-demo'
import { demonstrationLocaleAutorisee } from '@/lib/demo/activation'

export const metadata: Metadata = {
  title: 'Démonstration locale',
  description: 'Environnement local avec données fictives Sikaloc.',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function PageDemo() {
  const entetes = await headers()
  if (!demonstrationLocaleAutorisee(entetes.get('host'))) notFound()

  return <EnvironnementDemo />
}
