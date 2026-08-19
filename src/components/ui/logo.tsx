import Link from 'next/link'

/**
 * Marque Sikaloc — wordmark accompagné d'une icône « maison qui pousse ».
 *
 * L'icône reprend le motif de la feuille sur un toit : l'argent qui pousse,
 * signature indigo du design system.
 */
export function MarqueSikaloc({
  href = '/',
  taille = 'md',
  surSombre = false,
}: {
  href?: string | null
  taille?: 'sm' | 'md' | 'lg'
  surSombre?: boolean
}) {
  const tailles = {
    sm: { icone: 24, texte: 'text-display-xs' },
    md: { icone: 30, texte: 'text-display-sm' },
    lg: { icone: 36, texte: 'text-display-md' },
  }[taille]

  const contenu = (
    <span className="inline-flex items-center gap-sm">
      <IconeSikaloc taille={tailles.icone} />
      <span
        className={`${tailles.texte} font-extrabold tracking-tight ${
          surSombre ? 'text-on-dark' : 'text-ink'
        }`}
      >
        Sikaloc
      </span>
    </span>
  )

  if (!href) return contenu

  return (
    <Link href={href} className="inline-flex items-center">
      {contenu}
    </Link>
  )
}

export function IconeSikaloc({ taille = 30 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <rect width="32" height="32" rx="9" fill="#5C5CCC" />
      {/* Toit */}
      <path
        d="M8.5 15.5 16 9.5l7.5 6"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Murs */}
      <path
        d="M10.5 15v7.5h11V15"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* La pousse : le loyer qui rentre */}
      <path
        d="M16 22.5v-3.6"
        stroke="#C7C7F2"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M16 19.2c0-1.4 1.1-2.5 2.4-2.5 0 1.4-1 2.5-2.4 2.5Z"
        fill="#C7C7F2"
      />
    </svg>
  )
}
