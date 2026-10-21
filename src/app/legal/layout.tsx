import Link from 'next/link'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { MarqueSikaloc } from '@/components/ui/logo'
import { mentionsCompletes } from '@/lib/mentions-legales'

export default function LayoutLegal({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-soft">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-xl">
          <MarqueSikaloc />
          <Link href="/" className="text-nav-link text-body hover:text-ink">
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-xl py-4xl">
        <div className="grid items-start gap-xl lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Documents juridiques" className="card flex flex-wrap gap-md text-body-sm lg:sticky lg:top-24 lg:flex-col">
            <Link href="/legal/conditions" className="font-medium text-ink hover:underline">Conditions d’utilisation</Link>
            <Link href="/legal/confidentialite" className="font-medium text-ink hover:underline">Confidentialité</Link>
            {mentionsCompletes() ? <Link href="/legal/mentions" className="font-medium text-ink hover:underline">Mentions légales</Link> : null}
          </nav>
          <article className="legal-copy card card-lg min-w-0">{children}</article>
        </div>
      </main>

      <PiedDePage />
    </div>
  )
}
