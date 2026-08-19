import Link from 'next/link'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { MarqueSikaloc } from '@/components/ui/logo'

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

      <main className="mx-auto max-w-[48rem] px-xl py-4xl">
        <article className="card card-lg">{children}</article>
      </main>

      <PiedDePage />
    </div>
  )
}
