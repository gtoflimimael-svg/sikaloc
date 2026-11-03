import type { ReactNode } from 'react'

import { EnteteEditorial } from '@/components/marketing/entete-editorial'

export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <EnteteEditorial contexte="Guide Sikaloc" action={{ href: '/', libelle: 'Accueil' }} />
      {children}
    </div>
  )
}
