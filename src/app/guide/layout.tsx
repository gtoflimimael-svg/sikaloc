import Link from 'next/link'
import type { ReactNode } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'

export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-soft">
      <header className="border-b border-hairline bg-white px-xl py-md">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-md">
          <MarqueSikaloc />
          <Link href="/" className="text-body-sm font-semibold text-ink hover:text-primary">
            Retour à l’accueil
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
