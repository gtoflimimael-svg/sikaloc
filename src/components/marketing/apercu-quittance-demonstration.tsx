import Image from 'next/image'

import { URL_EXEMPLE_QUITTANCE } from '@/lib/pdf/exemple-url'

/**
 * Aperçu statique de la première page du PDF public fictif. L’image est rendue
 * depuis le document source et le PDF complet reste disponible au même endroit.
 * Cette présentation conserve le document exact sans charger PDF.js dans
 * l’hydratation de l’accueil.
 */
export function ApercuQuittanceDemonstration() {
  return (
    <div className="home-document-stage">
      <div
        className="home-document-pdf"
        role="region"
        aria-label="Aperçu de la première page du PDF d’exemple de quittance Sikaloc"
      >
        <Image
          src="/images/exemple-quittance-apercu.webp"
          alt="Première page de la quittance fictive Sikaloc, indiquée comme exemple sans valeur justificative."
          width={993}
          height={1404}
          sizes="(max-width: 900px) 92vw, 560px"
          className="home-document-pdf-image"
        />
      </div>
      <a className="home-document-open" href={URL_EXEMPLE_QUITTANCE} target="_blank" rel="noreferrer">
        Ouvrir le PDF en pleine page
      </a>
    </div>
  )
}
