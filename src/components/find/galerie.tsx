'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'

import type { PhotoPublique } from '@/lib/types/database'

/**
 * La galerie d'une fiche Sikaloc_Find.
 *
 * Elle ne connaît que ce que `photos_publiees` rend — positions et dimensions —
 * et lit chaque image par `/find/photo/<référence>/<position>`. Jamais une URL
 * de stockage.
 *
 * Les positions ne sont pas supposées contiguës : une photo retirée laisse un
 * trou. La galerie parcourt la liste reçue, et part de la photo principale que
 * la projection désigne (`photoPrincipale`), sans supposer qu'elle vaut 0.
 *
 * Une seule grande image est chargée à la fois ; les vignettes, sous `sm`,
 * cèdent la place au compteur et aux flèches — le geste naturel au téléphone.
 */
export function Galerie({
  reference,
  photos,
  photoPrincipale,
  description,
}: {
  reference: string
  photos: PhotoPublique[]
  photoPrincipale: number | null
  /** « Appartement · 2 chambres salon à louer — Akpakpa, Cotonou » */
  description: string
}) {
  const depart = Math.max(0, photos.findIndex((p) => p.position === photoPrincipale))
  const [indice, setIndice] = useState(depart)
  const [erreur, setErreur] = useState(false)
  const aide = useId()

  if (photos.length === 0) return null

  const total = photos.length
  // La liste peut se raccourcir après une actualisation, sans remonter le composant.
  const courant = Math.min(indice, total - 1)
  const photo = photos[courant]
  const aller = (i: number) => { setErreur(false); setIndice((i + total) % total) }
  const url = (p: PhotoPublique) => `/find/photo/${reference}/${p.position}`

  return (
    <section
      aria-roledescription="galerie"
      tabIndex={total > 1 ? 0 : undefined}
      aria-describedby={total > 1 ? aide : undefined}
      aria-label={`Photos du logement, ${total} au total`}
      className="space-y-md"
      onKeyDown={(e) => {
        if (total < 2) return
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
        e.preventDefault()
        if (e.key === 'ArrowRight') aller(courant + 1)
        if (e.key === 'ArrowLeft') aller(courant - 1)
        if (e.key === 'Home') aller(0)
        if (e.key === 'End') aller(total - 1)
      }}
    >
      {total > 1 ? <p id={aide} className="sr-only">Utilisez les flèches gauche et droite pour parcourir les photos.</p> : null}
      <div className="relative overflow-hidden rounded-lg border border-hairline bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.position}
          src={url(photo)}
          alt={`${description}, photo ${courant + 1} sur ${total}`}
          width={photo.largeur}
          height={photo.hauteur}
          fetchPriority={courant === depart ? 'high' : 'auto'}
          onError={() => setErreur(true)}
          className={`aspect-[4/3] w-full object-contain ${erreur ? 'hidden' : ''}`}
        />

        {erreur ? <p role="alert" className="flex aspect-[4/3] items-center justify-center p-lg text-body-sm text-mute">Cette photo n’a pas pu être chargée. Vous pouvez consulter les autres photos.</p> : null}
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => aller(courant - 1)}
              aria-label="Photo précédente"
              className="absolute left-sm top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-canvas/90 text-ink shadow-sm hover:bg-canvas"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => aller(courant + 1)}
              aria-label="Photo suivante"
              className="absolute right-sm top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-canvas/90 text-ink shadow-sm hover:bg-canvas"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-sm right-sm rounded-pill border border-hairline bg-canvas px-sm py-xxs text-caption font-medium text-ink"
            >
              <span className="sr-only">Photo </span>
              {courant + 1} / {total}
            </p>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="hidden grid-cols-8 gap-xs sm:grid" aria-label="Choisir une photo">
          {photos.map((p, i) => (
            <li key={p.position}>
              <button
                type="button"
                onClick={() => aller(i)}
                aria-label={`Afficher la photo ${i + 1} sur ${total}`}
                aria-current={i === courant ? 'true' : undefined}
                className={`block min-h-11 w-full overflow-hidden rounded-md border-2 ${
                  i === courant ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(p)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
