import Image from 'next/image'
import Link from 'next/link'

import { COULEUR_MARQUE, TRACES_ICONE, TRANSFORM_ICONE } from '@/lib/marque'

export type SuffixeEspace = 'Pro' | 'Me'

const HAUTEURS = { sm: 25, md: 35, lg: 49 } as const

/** Mot-symbole intact, importé du kit officiel validé. */
export function MarqueSikaloc({
  href = '/',
  taille = 'md',
  surSombre = false,
  espace,
  className = '',
}: {
  href?: string | null
  taille?: keyof typeof HAUTEURS
  surSombre?: boolean
  espace?: SuffixeEspace
  className?: string
}) {
  const hauteur = HAUTEURS[taille]
  const logo = (
    <span className={`inline-flex max-w-full shrink-0 flex-nowrap items-center gap-2 ${className}`}>
      <Image
        src={surSombre ? '/marque/sikaloc-officiel-vert.svg' : '/marque/sikaloc-officiel-noir.svg'}
        alt={espace ? '' : 'Sikaloc'}
        width={883}
        height={206}
        unoptimized
        className={surSombre ? 'block h-auto shrink-0' : 'marque-officielle block h-auto shrink-0'}
        style={{ width: Math.round((883 / 206) * hauteur), height: hauteur }}
      />
      {espace ? (
        <span
          aria-hidden="true"
          className={`inline-flex h-[18px] shrink-0 items-center whitespace-nowrap border-l pl-2 text-sm font-semibold leading-none tracking-tight ${surSombre ? 'border-white/40 text-white' : 'border-hairline-strong text-ink'}`}
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {espace}
        </span>
      ) : null}
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex min-w-0 items-center" aria-label={espace ? `Sikaloc ${espace}` : 'Sikaloc'}>
        {logo}
      </Link>
    )
  }

  return espace ? <span role="img" aria-label={`Sikaloc ${espace}`}>{logo}</span> : logo
}

/** Signature visuelle partagée des espaces, fondée sur le logotype officiel. */
export function SikalocSpaceBrand({
  espace,
  ...props
}: Omit<Parameters<typeof MarqueSikaloc>[0], 'espace'> & { espace: SuffixeEspace }) {
  return <MarqueSikaloc {...props} espace={espace} />
}

/** Symbole carré historique gardé pour les usages applicatifs existants. */
export function IconeSikaloc({
  taille = 30,
  couleur = `var(--color-primary, ${COULEUR_MARQUE})`,
  className = '',
}: {
  taille?: number
  couleur?: string
  className?: string
}) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 600 600" fill={couleur} role="presentation" aria-hidden="true" className={className}>
      <g transform={TRANSFORM_ICONE}>
        {TRACES_ICONE.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  )
}
