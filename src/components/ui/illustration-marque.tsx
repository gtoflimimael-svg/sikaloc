import Image from 'next/image'

const illustrations = {
  ecosysteme: '/illustrations/home-01.webp',
  habitat: '/illustrations/home-02.webp',
  locataire: '/illustrations/home-03.webp',
  recherche: '/illustrations/home-04.webp',
} as const

/** Illustration éditoriale Sikaloc pour les états vides, jamais une annonce réelle. */
export function IllustrationMarque({
  variante,
}: {
  variante: keyof typeof illustrations
}) {
  return (
    <Image
      src={illustrations[variante]}
      alt=""
      aria-hidden="true"
      width={1200}
      height={900}
      sizes="136px"
    />
  )
}
