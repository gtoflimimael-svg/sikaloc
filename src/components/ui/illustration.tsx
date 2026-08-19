import { ILLUSTRATIONS, type NomIllustration } from '@/lib/illustrations/data'

export type { NomIllustration }

/**
 * Illustration Transhumans — composant SERVEUR uniquement.
 *
 * Le SVG est inséré dans le HTML rendu, jamais dans le bundle client : c'est ce
 * qui permet de servir 65 à 210 Ko de tracés sans alourdir le JavaScript. En
 * contrepartie, ce composant ne peut pas être appelé depuis un composant
 * marqué 'use client'.
 *
 * Le trait suit `currentColor` et les aplats `var(--color-canvas)` : une seule
 * version couvre donc le mode clair et le mode nuit.
 */
export function Illustration({
  nom,
  taille = 320,
  className = '',
  decorative = false,
}: {
  nom: NomIllustration
  taille?: number
  className?: string
  /** Purement atmosphérique : masquée aux lecteurs d'écran. */
  decorative?: boolean
}) {
  const { alt, svg } = ILLUSTRATIONS[nom]

  return (
    <svg
      viewBox="0 0 1080 1080"
      width={taille}
      height={taille}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
