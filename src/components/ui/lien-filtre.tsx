'use client'

import Link, { useLinkStatus } from 'next/link'
import { Spinner } from '@/components/ui/boutons'

function AttenteNavigation() {
  const { pending } = useLinkStatus()
  return <span className="inline-flex size-4 items-center justify-center" role="status">{pending ? <><Spinner taille={14} /><span className="sr-only">Chargement des résultats…</span></> : null}</span>
}

/** Un lien GET existant, avec indication de navigation sans changer son URL. */
export function LienFiltre({ href, actif, children }: {
  href: string
  actif: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={href} aria-current={actif ? 'page' : undefined} className={`filter-chip ${actif ? 'filter-chip-active' : ''}`}>
      {children}
      <AttenteNavigation />
    </Link>
  )
}
